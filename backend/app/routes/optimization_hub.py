from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.services.optimization_hub import (
    get_optimization_recommendations,
    get_savings_plans_recommendations,
    get_reservation_recommendations,
)

router = APIRouter(prefix="/api/optimization-hub", tags=["Cost Optimization Hub"])


@router.get("/recommendations")
def recommendations(
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    if not user.is_admin and acct_list:
        allowed = [acc.account_id for acc in user.aws_accounts]
        acct_list = [a for a in acct_list if a in allowed]
    elif not user.is_admin:
        acct_list = [acc.account_id for acc in user.aws_accounts] or None

    return get_optimization_recommendations(db, acct_list)


@router.get("/savings-plans")
def savings_plans(
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    if not user.is_admin and acct_list:
        allowed = [acc.account_id for acc in user.aws_accounts]
        acct_list = [a for a in acct_list if a in allowed]
    elif not user.is_admin:
        acct_list = [acc.account_id for acc in user.aws_accounts] or None

    return get_savings_plans_recommendations(db, acct_list)


@router.get("/reservations")
def reservations(
    service: str = Query("Amazon Elastic Compute Cloud - Compute"),
    account_ids: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    acct_list = account_ids.split(",") if account_ids else None
    if not user.is_admin and acct_list:
        allowed = [acc.account_id for acc in user.aws_accounts]
        acct_list = [a for a in acct_list if a in allowed]
    elif not user.is_admin:
        acct_list = [acc.account_id for acc in user.aws_accounts] or None

    return get_reservation_recommendations(db, service, acct_list)
