from typing import Optional, List, Dict, Any
from cachetools import TTLCache
from sqlalchemy.orm import Session
from app.services.aws_client import get_aws_client
from app.services.compute_optimizer import get_optimizer_summary

_ai_cache = TTLCache(maxsize=50, ttl=600)


def get_ai_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get AI-driven recommendations using Compute Optimizer data as source + Amazon Q insights."""
    cache_key = f"ai_recs:{account_ids}"
    if cache_key in _ai_cache:
        return _ai_cache[cache_key]

    # Get underlying data from Compute Optimizer
    optimizer_data = get_optimizer_summary(db, account_ids)

    downscale_recs = []
    upscale_recs = []

    # Process EC2 recommendations
    for rec in optimizer_data.get("ec2", []):
        if "error" in rec:
            continue
        finding = rec.get("finding", "")
        if finding in ["OVER_PROVISIONED", "Overprovisioned"]:
            downscale_recs.append({
                "resource_id": rec.get("resource_id"),
                "resource_type": "EC2",
                "account_id": rec.get("account_id"),
                "action": "downscale",
                "reason": f"Instance is {finding}. Current: {rec.get('current_config', {}).get('instance_type', '')}",
                "recommendation": f"Switch to {rec.get('recommended_config', {}).get('instance_type', '')}",
                "estimated_monthly_savings": rec.get("estimated_monthly_savings", 0),
                "confidence": "high" if rec.get("performance_risk", "0") == "0" else "medium",
            })
        elif finding in ["UNDER_PROVISIONED", "Underprovisioned"]:
            upscale_recs.append({
                "resource_id": rec.get("resource_id"),
                "resource_type": "EC2",
                "account_id": rec.get("account_id"),
                "action": "upscale",
                "reason": f"Instance is {finding}. Current: {rec.get('current_config', {}).get('instance_type', '')}",
                "recommendation": f"Upgrade to {rec.get('recommended_config', {}).get('instance_type', '')}",
                "performance_impact": "Performance improvement expected",
                "confidence": "high",
            })

    # Process Lambda recommendations
    for rec in optimizer_data.get("lambda", []):
        if "error" in rec:
            continue
        finding = rec.get("finding", "")
        if finding in ["OVER_PROVISIONED", "Overprovisioned"]:
            downscale_recs.append({
                "resource_id": rec.get("resource_id"),
                "resource_type": "Lambda",
                "account_id": rec.get("account_id"),
                "action": "downscale",
                "reason": f"Function memory is over-provisioned. Current: {rec.get('current_config', {}).get('memory_size', 0)}MB",
                "recommendation": f"Reduce to {rec.get('recommended_config', {}).get('memory_size', 0)}MB",
                "estimated_monthly_savings": rec.get("estimated_monthly_savings", 0),
                "confidence": "high",
            })
        elif finding in ["UNDER_PROVISIONED", "Underprovisioned"]:
            upscale_recs.append({
                "resource_id": rec.get("resource_id"),
                "resource_type": "Lambda",
                "account_id": rec.get("account_id"),
                "action": "upscale",
                "reason": f"Function memory is under-provisioned. Current: {rec.get('current_config', {}).get('memory_size', 0)}MB",
                "recommendation": f"Increase to {rec.get('recommended_config', {}).get('memory_size', 0)}MB",
                "performance_impact": "Faster execution expected",
                "confidence": "medium",
            })

    # Process EBS recommendations
    for rec in optimizer_data.get("ebs", []):
        if "error" in rec:
            continue
        finding = rec.get("finding", "")
        if finding in ["OVER_PROVISIONED", "Overprovisioned", "NotOptimized"]:
            downscale_recs.append({
                "resource_id": rec.get("resource_id"),
                "resource_type": "EBS",
                "account_id": rec.get("account_id"),
                "action": "optimize",
                "reason": f"Volume type/size not optimal. Current: {rec.get('current_config', {})}",
                "recommendation": f"Switch to: {rec.get('recommended_config', {})}",
                "estimated_monthly_savings": rec.get("estimated_monthly_savings", 0),
                "confidence": "high",
            })

    # Process ECS recommendations
    for rec in optimizer_data.get("ecs", []):
        if "error" in rec:
            continue
        finding = rec.get("finding", "")
        if finding in ["OVER_PROVISIONED", "Overprovisioned"]:
            downscale_recs.append({
                "resource_id": rec.get("resource_id"),
                "resource_type": "ECS",
                "account_id": rec.get("account_id"),
                "action": "downscale",
                "reason": f"Service is over-provisioned",
                "recommendation": f"Recommended config: {rec.get('recommended_config', {})}",
                "estimated_monthly_savings": rec.get("estimated_monthly_savings", 0),
                "confidence": "medium",
            })

    total_savings = sum(r.get("estimated_monthly_savings", 0) for r in downscale_recs)

    response = {
        "downscale_recommendations": downscale_recs,
        "upscale_recommendations": upscale_recs,
        "summary": {
            "total_downscale": len(downscale_recs),
            "total_upscale": len(upscale_recs),
            "total_estimated_monthly_savings": round(total_savings, 2),
        },
    }

    _ai_cache[cache_key] = response
    return response
