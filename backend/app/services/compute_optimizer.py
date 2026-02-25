from typing import Optional, List, Dict, Any
from cachetools import TTLCache
from sqlalchemy.orm import Session
from app.services.aws_client import get_aws_client, get_all_active_accounts

_optimizer_cache = TTLCache(maxsize=50, ttl=600)


def get_ec2_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get EC2 instance recommendations from Compute Optimizer."""
    cache_key = f"ec2_recs:{account_ids}"
    if cache_key in _optimizer_cache:
        return _optimizer_cache[cache_key]

    co = get_aws_client("compute-optimizer", db)
    params = {}
    if account_ids:
        params["accountIds"] = account_ids

    try:
        result = co.get_ec2_instance_recommendations(**params)
    except Exception as e:
        return [{"error": str(e)}]

    recommendations = []
    for rec in result.get("instanceRecommendations", []):
        current = rec.get("currentInstanceType", "")
        finding = rec.get("finding", "")
        options = rec.get("recommendationOptions", [])

        best_option = options[0] if options else {}
        projected_metrics = best_option.get("projectedUtilizationMetrics", [])
        savings = best_option.get("estimatedMonthlySavings", {})

        recommendations.append({
            "resource_id": rec.get("instanceArn", "").split("/")[-1] if rec.get("instanceArn") else "",
            "resource_type": "EC2",
            "account_id": rec.get("accountId", ""),
            "finding": finding,
            "current_config": {
                "instance_type": current,
            },
            "recommended_config": {
                "instance_type": best_option.get("instanceType", ""),
                "migration_effort": best_option.get("migrationEffort", ""),
            },
            "estimated_monthly_savings": round(float(savings.get("value", 0)), 2),
            "performance_risk": str(best_option.get("performanceRisk", "")),
            "resource_name": rec.get("instanceName", ""),
        })

    _optimizer_cache[cache_key] = recommendations
    return recommendations


def get_ebs_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get EBS volume recommendations."""
    co = get_aws_client("compute-optimizer", db)
    params = {}
    if account_ids:
        params["accountIds"] = account_ids

    try:
        result = co.get_ebs_volume_recommendations(**params)
    except Exception as e:
        return [{"error": str(e)}]

    recommendations = []
    for rec in result.get("volumeRecommendations", []):
        current = rec.get("currentConfiguration", {})
        finding = rec.get("finding", "")
        options = rec.get("volumeRecommendationOptions", [])
        best = options[0] if options else {}
        savings = best.get("estimatedMonthlySavings", {})
        config = best.get("configuration", {})

        recommendations.append({
            "resource_id": rec.get("volumeArn", "").split("/")[-1],
            "resource_type": "EBS",
            "account_id": rec.get("accountId", ""),
            "finding": finding,
            "current_config": {
                "volume_type": current.get("volumeType", ""),
                "volume_size": current.get("volumeSize", 0),
                "iops": current.get("volumeBaselineIOPS", 0),
            },
            "recommended_config": {
                "volume_type": config.get("volumeType", ""),
                "volume_size": config.get("volumeSize", 0),
                "iops": config.get("volumeBaselineIOPS", 0),
            },
            "estimated_monthly_savings": round(float(savings.get("value", 0)), 2),
        })

    return recommendations


def get_lambda_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get Lambda function recommendations."""
    co = get_aws_client("compute-optimizer", db)
    params = {}
    if account_ids:
        params["accountIds"] = account_ids

    try:
        result = co.get_lambda_function_recommendations(**params)
    except Exception as e:
        return [{"error": str(e)}]

    recommendations = []
    for rec in result.get("lambdaFunctionRecommendations", []):
        current = rec.get("currentMemorySize", 0)
        finding = rec.get("finding", "")
        options = rec.get("memorySizeRecommendationOptions", [])
        best = options[0] if options else {}
        savings = best.get("estimatedMonthlySavings", {})

        recommendations.append({
            "resource_id": rec.get("functionArn", "").split(":")[-1],
            "resource_type": "Lambda",
            "account_id": rec.get("accountId", ""),
            "finding": finding,
            "current_config": {"memory_size": current},
            "recommended_config": {
                "memory_size": best.get("memorySize", 0),
            },
            "estimated_monthly_savings": round(float(savings.get("value", 0)), 2),
        })

    return recommendations


def get_asg_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get Auto Scaling Group recommendations."""
    co = get_aws_client("compute-optimizer", db)
    params = {}
    if account_ids:
        params["accountIds"] = account_ids

    try:
        result = co.get_auto_scaling_group_recommendations(**params)
    except Exception as e:
        return [{"error": str(e)}]

    recommendations = []
    for rec in result.get("autoScalingGroupRecommendations", []):
        current = rec.get("currentConfiguration", {})
        finding = rec.get("finding", "")
        options = rec.get("recommendationOptions", [])
        best = options[0] if options else {}
        savings = best.get("estimatedMonthlySavings", {})

        recommendations.append({
            "resource_id": rec.get("autoScalingGroupArn", "").split("/")[-1],
            "resource_type": "AutoScaling",
            "account_id": rec.get("accountId", ""),
            "finding": finding,
            "current_config": {
                "instance_type": current.get("instanceType", ""),
                "desired_capacity": current.get("desiredCapacity", 0),
            },
            "recommended_config": {
                "instance_type": best.get("configuration", {}).get("instanceType", ""),
                "desired_capacity": best.get("configuration", {}).get("desiredCapacity", 0),
            },
            "estimated_monthly_savings": round(float(savings.get("value", 0)), 2),
        })

    return recommendations


def get_ecs_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get ECS on Fargate recommendations."""
    co = get_aws_client("compute-optimizer", db)
    params = {}
    if account_ids:
        params["accountIds"] = account_ids

    try:
        result = co.get_ecs_service_recommendations(**params)
    except Exception as e:
        return [{"error": str(e)}]

    recommendations = []
    for rec in result.get("ecsServiceRecommendations", []):
        finding = rec.get("finding", "")
        options = rec.get("serviceRecommendationOptions", [])
        best = options[0] if options else {}
        savings = best.get("estimatedMonthlySavings", {})

        recommendations.append({
            "resource_id": rec.get("serviceArn", "").split("/")[-1],
            "resource_type": "ECS",
            "account_id": rec.get("accountId", ""),
            "finding": finding,
            "current_config": {
                "cpu": rec.get("currentServiceConfiguration", {}).get("cpu", 0),
                "memory": rec.get("currentServiceConfiguration", {}).get("memory", 0),
            },
            "recommended_config": {
                "cpu": best.get("cpu", 0),
                "memory": best.get("memory", 0),
            },
            "estimated_monthly_savings": round(float(savings.get("value", 0)), 2),
        })

    return recommendations


def get_optimizer_summary(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get summary of all Compute Optimizer recommendations."""
    ec2 = get_ec2_recommendations(db, account_ids)
    ebs = get_ebs_recommendations(db, account_ids)
    lmb = get_lambda_recommendations(db, account_ids)
    asg = get_asg_recommendations(db, account_ids)
    ecs = get_ecs_recommendations(db, account_ids)

    all_recs = ec2 + ebs + lmb + asg + ecs
    valid_recs = [r for r in all_recs if "error" not in r]

    total_savings = sum(r.get("estimated_monthly_savings", 0) for r in valid_recs)

    findings_summary = {}
    for r in valid_recs:
        finding = r.get("finding", "Unknown")
        findings_summary[finding] = findings_summary.get(finding, 0) + 1

    by_type = {}
    for r in valid_recs:
        rt = r.get("resource_type", "Unknown")
        if rt not in by_type:
            by_type[rt] = {"count": 0, "savings": 0}
        by_type[rt]["count"] += 1
        by_type[rt]["savings"] += r.get("estimated_monthly_savings", 0)

    for v in by_type.values():
        v["savings"] = round(v["savings"], 2)

    return {
        "total_recommendations": len(valid_recs),
        "total_estimated_monthly_savings": round(total_savings, 2),
        "findings_summary": findings_summary,
        "by_resource_type": by_type,
        "ec2": ec2,
        "ebs": ebs,
        "lambda": lmb,
        "auto_scaling": asg,
        "ecs": ecs,
    }
