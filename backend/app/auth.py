from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, UserSession

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def parse_user_agent(ua: str) -> str:
    ua_lower = ua.lower() if ua else ""
    if "firefox" in ua_lower:
        return "Firefox"
    elif "edg" in ua_lower:
        return "Edge"
    elif "chrome" in ua_lower:
        return "Chrome"
    elif "safari" in ua_lower:
        return "Safari"
    elif "opera" in ua_lower or "opr" in ua_lower:
        return "Opera"
    return "Unknown"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    request: Request = None,
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # Check session validity
    session = db.query(UserSession).filter(
        UserSession.token == token,
        UserSession.is_active == True,
    ).first()
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    # Check session timeout
    now = datetime.now(timezone.utc)
    if session.last_activity:
        last = session.last_activity.replace(tzinfo=timezone.utc) if session.last_activity.tzinfo is None else session.last_activity
        inactive = (now - last).total_seconds() / 60
        if inactive > settings.SESSION_TIMEOUT_MINUTES:
            session.is_active = False
            db.commit()
            raise HTTPException(status_code=401, detail="Session timed out")

    # Update last activity
    session.last_activity = now
    db.commit()

    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
