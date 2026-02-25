from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from cachetools import TTLCache
from sqlalchemy.orm import Session
from app.services.aws_client import get_aws_client, get_root_account

_cost_cache = TTLCache(maxsize=200, ttl=300)


def _cache_key(prefix: str, **kwargs) -> str:
    parts = [prefix] + [f"{k}={v}" for k, v in sorted(kwargs.items())]
    return ":".join(parts)


# RECORD_TYPE filter: include only Usage, Tax, Credit, Refund to match AWS Billing Console
_RECORD_TYPE_FILTER = {
    "Dimensions": {
        "Key": "RECORD_TYPE",
        "Values": ["Usage", "Tax", "Credit", "Refund"],
    }
}


def get_cost_and_usage(
    db: Session,
    start_date: str,
    end_date: str,
    granularity: str = "MONTHLY",
    account_ids: Optional[List[str]] = None,
    group_by: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Get cost and usage data from AWS Cost Explorer.

    Rules:
      - Metric is always UnblendedCost.
      - TimePeriod Start is inclusive, End is exclusive (AWS default).
      - A RECORD_TYPE filter restricts results to Usage/Tax/Credit/Refund
        so totals match the AWS Billing → Cost Explorer UI.
      - All dates should be in UTC (YYYY-MM-DD).
    """
    ck = _cache_key("cost_usage", start=start_date, end=end_date, gran=granularity,
                     accounts=str(account_ids), group=str(group_by))
    if ck in _cost_cache:
        return _cost_cache[ck]

    ce = get_aws_client("ce", db)

    params = {
        "TimePeriod": {"Start": start_date, "End": end_date},
        "Granularity": granularity,
        "Metrics": ["UnblendedCost"],
    }

    # Build composite filter: always include RECORD_TYPE, optionally LINKED_ACCOUNT
    filters = [_RECORD_TYPE_FILTER]
    if account_ids:
        filters.append({
            "Dimensions": {
                "Key": "LINKED_ACCOUNT",
                "Values": account_ids,
            }
        })

    if len(filters) == 1:
        params["Filter"] = filters[0]
    else:
        params["Filter"] = {"And": filters}

    if group_by:
        params["GroupDefinitions"] = group_by

    result = ce.get_cost_and_usage(**params)
    _cost_cache[ck] = result
    return result


def get_cost_overview(
    db: Session,
    start_date: str,
    end_date: str,
    granularity: str = "DAILY",
    account_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get overall cost data for the selected period."""
    result = get_cost_and_usage(db, start_date, end_date, granularity, account_ids)

    daily_costs = []
    total = 0.0
    for period in result.get("ResultsByTime", []):
        amount = float(period["Total"]["UnblendedCost"]["Amount"])
        total += amount
        daily_costs.append({
            "date": period["TimePeriod"]["Start"],
            "amount": round(amount, 2),
            "currency": "USD",
        })

    return {
        "total_cost": round(total, 2),
        "currency": "USD",
        "daily_costs": daily_costs,
    }


def get_cost_by_service(
    db: Session,
    start_date: str,
    end_date: str,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get cost breakdown by AWS service."""
    result = get_cost_and_usage(
        db, start_date, end_date, "MONTHLY", account_ids,
        group_by=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    services = {}
    for period in result.get("ResultsByTime", []):
        for group in period.get("Groups", []):
            svc = group["Keys"][0]
            amt = float(group["Metrics"]["UnblendedCost"]["Amount"])
            services[svc] = services.get(svc, 0) + amt

    return [
        {"service": k, "cost": round(v, 2)}
        for k, v in sorted(services.items(), key=lambda x: x[1], reverse=True)
    ]


def get_cost_by_region(
    db: Session,
    start_date: str,
    end_date: str,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get cost breakdown by region."""
    result = get_cost_and_usage(
        db, start_date, end_date, "MONTHLY", account_ids,
        group_by=[{"Type": "DIMENSION", "Key": "REGION"}],
    )

    regions = {}
    for period in result.get("ResultsByTime", []):
        for group in period.get("Groups", []):
            region = group["Keys"][0]
            amt = float(group["Metrics"]["UnblendedCost"]["Amount"])
            regions[region] = regions.get(region, 0) + amt

    return [
        {"region": k, "cost": round(v, 2)}
        for k, v in sorted(regions.items(), key=lambda x: x[1], reverse=True)
    ]


def get_cost_by_account(
    db: Session,
    start_date: str,
    end_date: str,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get cost breakdown by linked account."""
    result = get_cost_and_usage(
        db, start_date, end_date, "MONTHLY", account_ids,
        group_by=[{"Type": "DIMENSION", "Key": "LINKED_ACCOUNT"}],
    )

    accounts = {}
    for period in result.get("ResultsByTime", []):
        for group in period.get("Groups", []):
            acct = group["Keys"][0]
            amt = float(group["Metrics"]["UnblendedCost"]["Amount"])
            accounts[acct] = accounts.get(acct, 0) + amt

    return [
        {"account_id": k, "cost": round(v, 2)}
        for k, v in sorted(accounts.items(), key=lambda x: x[1], reverse=True)
    ]


def get_cost_by_usage_type(
    db: Session,
    start_date: str,
    end_date: str,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Get cost breakdown by usage type."""
    result = get_cost_and_usage(
        db, start_date, end_date, "MONTHLY", account_ids,
        group_by=[{"Type": "DIMENSION", "Key": "USAGE_TYPE"}],
    )

    types = {}
    for period in result.get("ResultsByTime", []):
        for group in period.get("Groups", []):
            ut = group["Keys"][0]
            amt = float(group["Metrics"]["UnblendedCost"]["Amount"])
            types[ut] = types.get(ut, 0) + amt

    items = [
        {"usage_type": k, "cost": round(v, 2)}
        for k, v in sorted(types.items(), key=lambda x: x[1], reverse=True)
    ]
    return items[:50]  # Top 50


def get_top_resources(
    db: Session,
    start_date: str,
    end_date: str,
    account_ids: Optional[List[str]] = None,
    page: int = 1,
    page_size: int = 20,
) -> Dict[str, Any]:
    """Get top costly resources using Cost Explorer with resource tags."""
    ce = get_aws_client("ce", db)

    params = {
        "TimePeriod": {"Start": start_date, "End": end_date},
        "Granularity": "MONTHLY",
        "Metrics": ["UnblendedCost"],
        "GroupDefinitions": [
            {"Type": "DIMENSION", "Key": "SERVICE"},
            {"Type": "TAG", "Key": "Name"},
        ],
    }

    # Always apply RECORD_TYPE filter; optionally combine with account filter
    filters = [_RECORD_TYPE_FILTER]
    if account_ids:
        filters.append({
            "Dimensions": {"Key": "LINKED_ACCOUNT", "Values": account_ids}
        })

    if len(filters) == 1:
        params["Filter"] = filters[0]
    else:
        params["Filter"] = {"And": filters}

    result = ce.get_cost_and_usage(**params)

    resources = {}
    for period in result.get("ResultsByTime", []):
        for group in period.get("Groups", []):
            keys = group["Keys"]
            service = keys[0]
            name = keys[1] if len(keys) > 1 else "Untagged"
            if name.startswith("Name$"):
                name = name[5:]
            key = f"{service}::{name}"
            amt = float(group["Metrics"]["UnblendedCost"]["Amount"])
            if key in resources:
                resources[key]["cost"] += amt
            else:
                resources[key] = {"service": service, "name": name, "cost": amt}

    sorted_resources = sorted(resources.values(), key=lambda x: x["cost"], reverse=True)
    total = len(sorted_resources)
    start = (page - 1) * page_size
    end = start + page_size
    page_resources = sorted_resources[start:end]

    for r in page_resources:
        r["cost"] = round(r["cost"], 2)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "resources": page_resources,
    }


def _first_of_month(dt: datetime) -> datetime:
    """Return the first day of the month for a given datetime (UTC)."""
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _first_of_next_month(dt: datetime) -> datetime:
    """Return the first day of the *next* month (UTC)."""
    if dt.month == 12:
        return dt.replace(year=dt.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    return dt.replace(month=dt.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)


def _subtract_months(dt: datetime, months: int) -> datetime:
    """Subtract N calendar months from a datetime (UTC). Returns 1st of that month."""
    month = dt.month - months
    year = dt.year
    while month <= 0:
        month += 12
        year -= 1
    return datetime(year, month, 1, tzinfo=timezone.utc)


def get_six_month_comparison(
    db: Session,
    account_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Compare costs over the last 6 months.

    For the current (partial) month the end date is tomorrow (exclusive, UTC).
    For completed months, start = 1st of month, end = 1st of next month.
    """
    now = datetime.now(timezone.utc)
    months = []

    for i in range(6):
        if i == 0:
            # Current (partial) month: 1st of this month → tomorrow
            start = _first_of_month(now)
            end = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            start = _subtract_months(now, i)
            end = _first_of_next_month(start)

        overview = get_cost_overview(
            db,
            start.strftime("%Y-%m-%d"),
            end.strftime("%Y-%m-%d"),
            "MONTHLY",
            account_ids,
        )
        months.append({
            "month": start.strftime("%Y-%m"),
            "total_cost": overview["total_cost"],
        })

    # Calculate month-over-month changes
    for i in range(len(months) - 1):
        current = months[i]["total_cost"]
        previous = months[i + 1]["total_cost"]
        if previous > 0:
            months[i]["change_percent"] = round(((current - previous) / previous) * 100, 2)
            months[i]["change_amount"] = round(current - previous, 2)
        else:
            months[i]["change_percent"] = None
            months[i]["change_amount"] = None

    return months
