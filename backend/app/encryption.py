import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from app.config import settings


def _get_fernet():
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"aws-cost-mgmt-salt-v1",
        iterations=100_000,
    )
    key = base64.urlsafe_b64encode(
        kdf.derive(settings.ENCRYPTION_KEY.encode())
    )
    return Fernet(key)


_fernet = _get_fernet()


def encrypt_value(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt_value(encrypted: str) -> str:
    return _fernet.decrypt(encrypted.encode()).decode()
