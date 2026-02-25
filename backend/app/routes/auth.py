from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database import get_db
from app.models import User, UserSession, LoginHistory
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, parse_user_agent,
)
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()

    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    browser = parse_user_agent(ua)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    if user.login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
        user.is_active = False
        db.commit()
        raise HTTPException(
            status_code=403,
            detail="Account locked due to too many failed attempts",
        )

    if not verify_password(req.password, user.hashed_password):
        user.login_attempts += 1
        db.add(LoginHistory(
            user_id=user.id, ip_address=ip, user_agent=ua,
            browser=browser, success=False,
        ))
        db.commit()
        remaining = settings.MAX_LOGIN_ATTEMPTS - user.login_attempts
        raise HTTPException(
            status_code=401,
            detail=f"Invalid credentials. {remaining} attempts remaining.",
        )

    # Check active sessions limit
    active_sessions = db.query(UserSession).filter(
        UserSession.user_id == user.id,
        UserSession.is_active == True,
    ).count()

    if active_sessions >= settings.MAX_ACTIVE_SESSIONS:
        # Invalidate oldest session
        oldest = db.query(UserSession).filter(
            UserSession.user_id == user.id,
            UserSession.is_active == True,
        ).order_by(UserSession.created_at.asc()).first()
        if oldest:
            oldest.is_active = False
            db.flush()

    # Reset login attempts on successful login
    user.login_attempts = 0

    # Create token
    token = create_access_token({"sub": str(user.id), "username": user.username, "is_admin": user.is_admin})

    # Create session
    session = UserSession(
        user_id=user.id,
        token=token,
        ip_address=ip,
        user_agent=ua,
        browser=browser,
    )
    db.add(session)

    # Log successful login
    db.add(LoginHistory(
        user_id=user.id, ip_address=ip, user_agent=ua,
        browser=browser, success=True,
    ))
    db.commit()

    account_ids = [acc.id for acc in user.aws_accounts]

    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            is_admin=user.is_admin,
            is_active=user.is_active,
            login_attempts=user.login_attempts,
            created_at=user.created_at,
            account_ids=account_ids,
        ),
    )


@router.post("/logout")
def logout(
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = request.headers.get("authorization", "").replace("Bearer ", "")
    session = db.query(UserSession).filter(
        UserSession.token == token,
        UserSession.is_active == True,
    ).first()
    if session:
        session.is_active = False
        db.commit()
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    account_ids = [acc.id for acc in user.aws_accounts]
    return UserOut(
        id=user.id,
        username=user.username,
        is_admin=user.is_admin,
        is_active=user.is_active,
        login_attempts=user.login_attempts,
        created_at=user.created_at,
        account_ids=account_ids,
    )
