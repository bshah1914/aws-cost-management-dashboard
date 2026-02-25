from typing import Optional, List, Dict, Any
from cachetools import TTLCache
from sqlalchemy.orm import Session
from app.services.aws_client import get_aws_client

_anomaly_cache = TTLCache(maxsize=50, ttl=300)


def get_anomalies(
    db: Session,
    account_ids: Optional[List[str]] = None,
    days_back: int = 90,
) -> Dict[str, Any]:
    """Get cost anomalies from AWS Cost Anomaly Detection."""
    cache_key = f"anomalies:{account_ids}:{days_back}"
    if cache_key in _anomaly_cache:
        return _anomaly_cache[cache_key]

    ce = get_aws_client("ce", db)

    from datetime import datetime, timedelta, timezone
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime("%Y-%m-%d")

    try:
        # Get anomaly monitors
        monitors_response = ce.get_anomaly_monitors()
        monitors = monitors_response.get("AnomalyMonitors", [])

        # Get anomalies
        params = {
            "DateInterval": {
                "StartDate": start_date,
                "EndDate": end_date,
            },
            "MaxResults": 100,
        }

        result = ce.get_anomalies(**params)
        anomalies_raw = result.get("Anomalies", [])

    except Exception as e:
        return {
            "error": str(e),
            "anomalies": [],
            "total_impact": 0,
            "monitors": [],
        }

    anomalies = []
    total_impact = 0
    for a in anomalies_raw:
        impact = a.get("Impact", {})
        actual = float(impact.get("TotalActualSpend", 0))
        expected = float(impact.get("TotalExpectedSpend", 0))
        anomaly_impact = actual - expected

        root_causes = []
        for rc in a.get("RootCauses", []):
            root_causes.append({
                "service": rc.get("Service", ""),
                "region": rc.get("Region", ""),
                "linked_account": rc.get("LinkedAccount", ""),
                "usage_type": rc.get("UsageType", ""),
            })

        anomaly_data = {
            "anomaly_id": a.get("AnomalyId", ""),
            "start_date": a.get("AnomalyStartDate", ""),
            "end_date": a.get("AnomalyEndDate", ""),
            "expected_spend": round(expected, 2),
            "actual_spend": round(actual, 2),
            "impact": round(anomaly_impact, 2),
            "root_causes": root_causes,
            "feedback": a.get("Feedback", ""),
            "severity": a.get("AnomalyScore", {}).get("MaxScore", 0),
        }

        # Filter by account if needed
        if account_ids:
            account_match = any(
                rc.get("linked_account") in account_ids for rc in root_causes
            )
            if not account_match and root_causes:
                continue

        anomalies.append(anomaly_data)
        total_impact += anomaly_impact

    monitor_info = [
        {
            "monitor_id": m.get("MonitorArn", "").split("/")[-1],
            "monitor_name": m.get("MonitorName", ""),
            "monitor_type": m.get("MonitorType", ""),
            "creation_date": m.get("CreationDate", ""),
        }
        for m in monitors
    ]

    response = {
        "anomalies": anomalies,
        "total_impact": round(total_impact, 2),
        "total_count": len(anomalies),
        "monitors": monitor_info,
    }

    _anomaly_cache[cache_key] = response
    return response
