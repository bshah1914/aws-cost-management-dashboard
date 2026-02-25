from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.auth import get_admin_user
from app.models import User, UserSession, LoginHistory, AWSAccount, user_account_association
from app.schemas import (
    UserCreate, UserUpdate, UserOut, UserDetailOut,
    AWSAccountCreate, AWSAccountUpdate, AWSAccountOut,
    SessionOut, LoginHistoryOut, PasswordReset,
)
from app.auth import hash_password
from app.encryption import encrypt_value, decrypt_value

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ---- AWS Accounts ----

@router.get("/accounts", response_model=List[AWSAccountOut])
def list_accounts(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    return db.query(AWSAccount).all()


@router.post("/accounts", response_model=AWSAccountOut)
def create_account(
    data: AWSAccountCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    existing = db.query(AWSAccount).filter(AWSAccount.account_id == data.account_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists")

    if data.is_root:
        existing_root = db.query(AWSAccount).filter(AWSAccount.is_root == True).first()
        if existing_root:
            raise HTTPException(status_code=400, detail="Root account already configured")

    account = AWSAccount(
        account_id=data.account_id,
        account_name=data.account_name,
        is_root=data.is_root,
        access_key_encrypted=encrypt_value(data.access_key),
        secret_key_encrypted=encrypt_value(data.secret_key),
        region=data.region,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.put("/accounts/{account_id}", response_model=AWSAccountOut)
def update_account(
    account_id: int,
    data: AWSAccountUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    account = db.query(AWSAccount).filter(AWSAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if data.account_name is not None:
        account.account_name = data.account_name
    if data.access_key is not None:
        account.access_key_encrypted = encrypt_value(data.access_key)
    if data.secret_key is not None:
        account.secret_key_encrypted = encrypt_value(data.secret_key)
    if data.region is not None:
        account.region = data.region
    if data.is_active is not None:
        account.is_active = data.is_active

    db.commit()
    db.refresh(account)
    return account


@router.delete("/accounts/{account_id}")
def delete_account(
    account_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    account = db.query(AWSAccount).filter(AWSAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
    return {"message": "Account deleted"}


# ---- Users ----

@router.get("/users", response_model=List[UserDetailOut])
def list_users(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    users = db.query(User).all()
    result = []
    for u in users:
        plain = None
        if u.plain_password_encrypted:
            try:
                plain = decrypt_value(u.plain_password_encrypted)
            except Exception:
                plain = None
        result.append(UserDetailOut(
            id=u.id,
            username=u.username,
            is_admin=u.is_admin,
            is_active=u.is_active,
            login_attempts=u.login_attempts,
            created_at=u.created_at,
            account_ids=[acc.id for acc in u.aws_accounts],
            plain_password=plain,
        ))
    return result


@router.post("/users", response_model=UserOut)
def create_user(
    data: UserCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        username=data.username,
        hashed_password=hash_password(data.password),
        plain_password_encrypted=encrypt_value(data.password),
        is_admin=data.is_admin,
    )
    db.add(user)
    db.flush()

    # Assign accounts
    if data.account_ids:
        accounts = db.query(AWSAccount).filter(AWSAccount.id.in_(data.account_ids)).all()
        user.aws_accounts = accounts

    db.commit()
    db.refresh(user)

    return UserOut(
        id=user.id,
        username=user.username,
        is_admin=user.is_admin,
        is_active=user.is_active,
        login_attempts=user.login_attempts,
        created_at=user.created_at,
        account_ids=[acc.id for acc in user.aws_accounts],
    )


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.is_active is not None:
        user.is_active = data.is_active
        if data.is_active:
            user.login_attempts = 0
    if data.account_ids is not None:
        accounts = db.query(AWSAccount).filter(AWSAccount.id.in_(data.account_ids)).all()
        user.aws_accounts = accounts

    db.commit()
    return {"message": "User updated"}


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: int,
    data: PasswordReset,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    user.plain_password_encrypted = encrypt_value(data.new_password)
    user.login_attempts = 0

    # Invalidate all sessions
    db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_active == True,
    ).update({"is_active": False})

    db.commit()
    return {"message": "Password reset successfully"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.username == "kpiadmin":
        raise HTTPException(status_code=400, detail="Cannot delete the primary admin")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}


# ---- Sessions ----

@router.get("/sessions", response_model=List[SessionOut])
def list_sessions(
    user_id: Optional[int] = Query(None),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(UserSession)
    if user_id:
        q = q.filter(UserSession.user_id == user_id)
    return q.order_by(UserSession.created_at.desc()).limit(200).all()


@router.post("/sessions/{session_id}/revoke")
def revoke_session(
    session_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = False
    db.commit()
    return {"message": "Session revoked"}


@router.post("/sessions/revoke-all/{user_id}")
def revoke_all_sessions(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_active == True,
    ).update({"is_active": False})
    db.commit()
    return {"message": "All sessions revoked"}


# ---- Login History ----

@router.get("/login-history", response_model=List[LoginHistoryOut])
def login_history(
    user_id: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(LoginHistory)
    if user_id:
        q = q.filter(LoginHistory.user_id == user_id)
    return q.order_by(LoginHistory.timestamp.desc()).limit(limit).all()
