from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models import User
from app.services.anomaly_detection import get_anomalies

router = APIRouter(prefix="/api/anomalies", tags=["Anomaly Detection"])


@router.get("/")
def anomalies(
    days_back: int = Query(90, ge=1, le=365),
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

    return get_anomalies(db, acct_list, days_back)
