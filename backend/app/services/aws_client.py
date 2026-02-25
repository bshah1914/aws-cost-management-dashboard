import boto3
from typing import Optional
from sqlalchemy.orm import Session
from app.models import AWSAccount
from app.encryption import decrypt_value
from cachetools import TTLCache

# Cache boto3 clients for 5 minutes
_client_cache = TTLCache(maxsize=100, ttl=300)


def get_aws_client(
    service_name: str,
    db: Session,
    account_id: Optional[int] = None,
    region: Optional[str] = None,
):
    """Get a boto3 client for the specified AWS service and account."""
    if account_id:
        account = db.query(AWSAccount).filter(AWSAccount.id == account_id).first()
    else:
        # Default to root account, fall back to any active account
        account = db.query(AWSAccount).filter(AWSAccount.is_root == True, AWSAccount.is_active == True).first()
        if not account:
            account = db.query(AWSAccount).filter(AWSAccount.is_active == True).first()

    if not account:
        raise ValueError("No AWS account configured")

    cache_key = f"{service_name}:{account.id}:{region or account.region}"
    if cache_key in _client_cache:
        return _client_cache[cache_key]

    access_key = decrypt_value(account.access_key_encrypted)
    secret_key = decrypt_value(account.secret_key_encrypted)

    client = boto3.client(
        service_name,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region or account.region,
    )
    _client_cache[cache_key] = client
    return client


def get_aws_client_by_account_id(
    service_name: str,
    db: Session,
    aws_account_id: str,
    region: Optional[str] = None,
):
    """Get a boto3 client using the AWS account ID string."""
    account = db.query(AWSAccount).filter(
        AWSAccount.account_id == aws_account_id,
        AWSAccount.is_active == True,
    ).first()
    if not account:
        raise ValueError(f"AWS account {aws_account_id} not found")
    return get_aws_client(service_name, db, account.id, region)


def get_all_active_accounts(db: Session):
    """Get all active AWS accounts."""
    return db.query(AWSAccount).filter(AWSAccount.is_active == True).all()


def get_root_account(db: Session):
    """Get the root/management account."""
    return db.query(AWSAccount).filter(
        AWSAccount.is_root == True,
        AWSAccount.is_active == True,
    ).first()
