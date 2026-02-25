from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.services.cost_explorer import (
    get_cost_overview, get_cost_by_service, get_cost_by_region,
    get_cost_by_account, get_cost_by_usage_type, get_top_resources,
    get_six_month_comparison,
)

router = APIRouter(prefix="/api/costs", tags=["Cost Explorer"])


def _make_end_exclusive(end_date: str) -> str:
    """Convert an inclusive end date to AWS-exclusive (add 1 day).

    Users enter inclusive ranges (e.g. Jan 1 – Jan 31 means *including* Jan 31).
    AWS Cost Explorer treats End as exclusive, so we must pass Feb 1 to include Jan 31.
    """
    ed = datetime.strptime(end_date, "%Y-%m-%d")
    return (ed + timedelta(days=1)).strftime("%Y-%m-%d")


def _get_user_account_ids(user: User, requested: Optional[List[str]] = None) -> Optional[List[str]]:
    """Get account IDs the user has access to."""
    if user.is_admin:
        return requested  # Admin can access all
    allowed = [acc.account_id for acc in user.aws_accounts]
    if not allowed:
        raise HTTPException(status_code=403, detail="No AWS accounts assigned")
    if requested:
        filtered = [a for a in requested if a in allowed]
        if not filtered:
            raise HTTPException(status_code=403, detail="No access to requested accounts")
        return filtered
    return allowed


@router.get("/overview")
def cost_overview(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    granularity: str = Query("DAILY", description="DAILY or MONTHLY"),
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)

    aws_end = _make_end_exclusive(end_date)
    current = get_cost_overview(db, start_date, aws_end, granularity, acct_list)

    # Calculate previous period
    try:
        sd = datetime.strptime(start_date, "%Y-%m-%d")
        ed = datetime.strptime(end_date, "%Y-%m-%d")
        delta = (ed - sd) + timedelta(days=1)  # inclusive range length
        prev_end = sd
        prev_start = prev_end - delta

        prev = get_cost_overview(
            db, prev_start.strftime("%Y-%m-%d"), prev_end.strftime("%Y-%m-%d"),
            granularity, acct_list,
        )
        current["previous_period_cost"] = prev["total_cost"]
        if prev["total_cost"] > 0:
            change = ((current["total_cost"] - prev["total_cost"]) / prev["total_cost"]) * 100
            current["change_percent"] = round(change, 2)
        else:
            current["change_percent"] = None
    except Exception:
        current["previous_period_cost"] = None
        current["change_percent"] = None

    return current


@router.get("/by-service")
def cost_by_service(
    start_date: str = Query(...),
    end_date: str = Query(...),
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)

    aws_end = _make_end_exclusive(end_date)
    current = get_cost_by_service(db, start_date, aws_end, acct_list)

    # Get previous period for comparison
    try:
        sd = datetime.strptime(start_date, "%Y-%m-%d")
        ed = datetime.strptime(end_date, "%Y-%m-%d")
        delta = (ed - sd) + timedelta(days=1)
        prev_end = sd
        prev_start = prev_end - delta

        prev = get_cost_by_service(
            db, prev_start.strftime("%Y-%m-%d"), prev_end.strftime("%Y-%m-%d"),
            acct_list,
        )
        prev_map = {s["service"]: s["cost"] for s in prev}

        for s in current:
            prev_cost = prev_map.get(s["service"], 0)
            s["previous_cost"] = prev_cost
            if prev_cost > 0:
                s["change_percent"] = round(((s["cost"] - prev_cost) / prev_cost) * 100, 2)
    except Exception:
        pass

    return current


@router.get("/by-region")
def cost_by_region(
    start_date: str = Query(...),
    end_date: str = Query(...),
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)
    return get_cost_by_region(db, start_date, _make_end_exclusive(end_date), acct_list)


@router.get("/by-account")
def cost_by_account(
    start_date: str = Query(...),
    end_date: str = Query(...),
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)
    return get_cost_by_account(db, start_date, _make_end_exclusive(end_date), acct_list)


@router.get("/by-usage-type")
def cost_by_usage_type(
    start_date: str = Query(...),
    end_date: str = Query(...),
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)
    return get_cost_by_usage_type(db, start_date, _make_end_exclusive(end_date), acct_list)


@router.get("/top-resources")
def top_resources(
    start_date: str = Query(...),
    end_date: str = Query(...),
    account_ids: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)
    return get_top_resources(db, start_date, _make_end_exclusive(end_date), acct_list, page, page_size)


@router.get("/six-month-comparison")
def six_month_comparison(
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)
    return get_six_month_comparison(db, acct_list)


@router.get("/export")
def export_costs(
    start_date: str = Query(...),
    end_date: str = Query(...),
    account_ids: Optional[str] = Query(None),
    format: str = Query("csv", description="csv or xlsx"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export cost data as CSV/Excel."""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    acct_list = account_ids.split(",") if account_ids else None
    acct_list = _get_user_account_ids(user, acct_list)

    resources = get_top_resources(db, start_date, _make_end_exclusive(end_date), acct_list, 1, 1000)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Service", "Resource Name", "Cost (USD)"])
        for r in resources["resources"]:
            writer.writerow([r["service"], r["name"], r["cost"]])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=costs_{start_date}_{end_date}.csv"},
        )
    else:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Cost Report"
        ws.append(["Service", "Resource Name", "Cost (USD)"])
        for r in resources["resources"]:
            ws.append([r["service"], r["name"], r["cost"]])
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=costs_{start_date}_{end_date}.xlsx"},
        )
