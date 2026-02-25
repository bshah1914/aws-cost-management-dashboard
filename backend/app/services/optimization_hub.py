from typing import Optional, List, Dict, Any
from cachetools import TTLCache
from sqlalchemy.orm import Session
from app.services.aws_client import get_aws_client

_hub_cache = TTLCache(maxsize=50, ttl=600)


def get_optimization_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get recommendations from AWS Cost Optimization Hub."""
    cache_key = f"opt_hub:{account_ids}"
    if cache_key in _hub_cache:
        return _hub_cache[cache_key]

    try:
        co = get_aws_client("cost-optimization-hub", db, region="us-east-1")

        params = {"maxResults": 100}
        if account_ids:
            params["filter"] = {
                "accountIds": account_ids,
            }

        result = co.list_recommendations(**params)
        items = result.get("items", [])

    except Exception as e:
        return {
            "error": str(e),
            "recommendations": [],
            "summary": {},
        }

    recommendations = []
    total_savings = 0
    by_action = {}
    by_resource_type = {}

    for item in items:
        savings = float(item.get("estimatedMonthlySavings", 0))
        savings_pct = float(item.get("estimatedSavingsPercentage", 0))
        action = item.get("actionType", "Unknown")
        resource_type = item.get("currentResourceType", "Unknown")

        recommendations.append({
            "recommendation_id": item.get("recommendationId", ""),
            "resource_id": item.get("resourceId", ""),
            "resource_type": resource_type,
            "account_id": item.get("accountId", ""),
            "action_type": action,
            "estimated_monthly_savings": round(savings, 2),
            "estimated_savings_percentage": round(savings_pct, 2),
            "description": item.get("recommendationLookbackPeriodInDays", ""),
            "implementation_effort": item.get("implementationEffort", ""),
            "restart_needed": item.get("restartNeeded", False),
            "rollback_possible": item.get("rollbackPossible", False),
        })

        total_savings += savings
        by_action[action] = by_action.get(action, 0) + savings
        by_resource_type[resource_type] = by_resource_type.get(resource_type, 0) + savings

    response = {
        "recommendations": recommendations,
        "summary": {
            "total_recommendations": len(recommendations),
            "total_estimated_monthly_savings": round(total_savings, 2),
            "by_action_type": {k: round(v, 2) for k, v in by_action.items()},
            "by_resource_type": {k: round(v, 2) for k, v in by_resource_type.items()},
        },
    }

    _hub_cache[cache_key] = response
    return response


def get_savings_plans_recommendations(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get Savings Plans recommendations."""
    try:
        ce = get_aws_client("ce", db)

        params = {
            "SavingsPlansType": "COMPUTE_SP",
            "TermInYears": "ONE_YEAR",
            "PaymentOption": "NO_UPFRONT",
            "LookbackPeriodInDays": "SIXTY_DAYS",
        }

        if account_ids:
            params["AccountScope"] = "LINKED"

        result = ce.get_savings_plans_purchase_recommendation(**params)
        meta = result.get("SavingsPlansPurchaseRecommendation", {})
        details = meta.get("SavingsPlansPurchaseRecommendationDetails", [])

    except Exception as e:
        return {"error": str(e), "plans": [], "summary": {}}

    plans = []
    total_savings = 0
    for d in details:
        est_savings = float(d.get("EstimatedMonthlySavingsAmount", 0))
        plans.append({
            "savings_plan_type": meta.get("SavingsPlansType", ""),
            "term": meta.get("TermInYears", ""),
            "payment_option": meta.get("PaymentOption", ""),
            "account_id": d.get("AccountId", ""),
            "hourly_commitment": float(d.get("HourlyCommitmentToPurchase", 0)),
            "estimated_monthly_savings": round(est_savings, 2),
            "estimated_savings_percentage": float(d.get("EstimatedSavingsPercentage", 0)),
            "current_on_demand_spend": float(d.get("CurrentAverageHourlyOnDemandSpend", 0)),
            "estimated_on_demand_cost": float(d.get("EstimatedAverageUtilization", 0)),
        })
        total_savings += est_savings

    return {
        "plans": plans,
        "summary": {
            "total_plans": len(plans),
            "total_estimated_monthly_savings": round(total_savings, 2),
        },
    }


def get_reservation_recommendations(
    db: Session,
    service: str = "Amazon Elastic Compute Cloud - Compute",
    account_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get Reserved Instance recommendations."""
    try:
        ce = get_aws_client("ce", db)

        params = {
            "Service": service,
            "TermInYears": "ONE_YEAR",
            "PaymentOption": "NO_UPFRONT",
            "LookbackPeriodInDays": "SIXTY_DAYS",
        }

        if account_ids:
            params["AccountScope"] = "LINKED"

        result = ce.get_reservation_purchase_recommendation(**params)
        recs = result.get("Recommendations", [])

    except Exception as e:
        return {"error": str(e), "reservations": [], "summary": {}}

    reservations = []
    total_savings = 0
    for rec in recs:
        details = rec.get("RecommendationDetails", [])
        for d in details:
            est_savings = float(d.get("EstimatedMonthlySavingsAmount", 0))
            reservations.append({
                "account_id": d.get("AccountId", ""),
                "instance_details": d.get("InstanceDetails", {}),
                "recommended_count": int(d.get("RecommendedNumberOfInstancesToPurchase", 0)),
                "estimated_monthly_savings": round(est_savings, 2),
                "upfront_cost": float(d.get("UpfrontCost", 0)),
                "recurring_cost": float(d.get("RecurringStandardMonthlyCost", 0)),
            })
            total_savings += est_savings

    return {
        "reservations": reservations,
        "summary": {
            "total_reservations": len(reservations),
            "total_estimated_monthly_savings": round(total_savings, 2),
        },
    }
