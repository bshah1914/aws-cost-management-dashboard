from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from cachetools import TTLCache
from sqlalchemy.orm import Session
from app.services.aws_client import get_aws_client

_forecast_cache = TTLCache(maxsize=50, ttl=600)


def get_cost_forecast(
    db: Session,
    months_ahead: int = 3,
    granularity: str = "MONTHLY",
    account_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get cost forecast from AWS Cost Explorer."""
    cache_key = f"forecast:{months_ahead}:{granularity}:{account_ids}"
    if cache_key in _forecast_cache:
        return _forecast_cache[cache_key]

    ce = get_aws_client("ce", db)

    now = datetime.now(timezone.utc)
    start_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    end_date = (now + timedelta(days=30 * months_ahead)).strftime("%Y-%m-%d")

    params = {
        "TimePeriod": {"Start": start_date, "End": end_date},
        "Metric": "UNBLENDED_COST",
        "Granularity": granularity,
        "PredictionIntervalLevel": 80,
    }

    if account_ids:
        params["Filter"] = {
            "Dimensions": {"Key": "LINKED_ACCOUNT", "Values": account_ids}
        }

    try:
        result = ce.get_cost_forecast(**params)
    except Exception as e:
        return {
            "error": str(e),
            "total_forecast": 0,
            "forecast_periods": [],
        }

    forecast_periods = []
    for period in result.get("ForecastResultsByTime", []):
        forecast_periods.append({
            "date": period["TimePeriod"]["Start"],
            "mean_value": round(float(period.get("MeanValue", 0)), 2),
            "prediction_interval_lower": round(
                float(period.get("PredictionIntervalLowerBound", 0)), 2
            ),
            "prediction_interval_upper": round(
                float(period.get("PredictionIntervalUpperBound", 0)), 2
            ),
        })

    total = round(float(result.get("Total", {}).get("Amount", 0)), 2)

    response = {
        "total_forecast": total,
        "currency": "USD",
        "months_ahead": months_ahead,
        "forecast_periods": forecast_periods,
    }

    _forecast_cache[cache_key] = response
    return response
