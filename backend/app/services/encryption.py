"""
Fernet symmetric encryption for sensitive fields (LLM API keys).
Uses the app's secret_key to derive a stable encryption key.
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)

# Derive a 32-byte Fernet key from the app secret
# Fernet requires a url-safe base64-encoded 32-byte key
_key = base64.urlsafe_b64encode(
    hashlib.sha256(settings.secret_key.encode()).digest()
)
_fernet = Fernet(_key)


def encrypt(value: str) -> str:
    """Encrypt a plaintext string, return base64 ciphertext."""
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    """Decrypt a ciphertext string, return plaintext."""
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        # If decryption fails, assume it's a legacy plaintext value
        logger.warning("Decryption failed — returning value as-is (possible legacy plaintext)")
        return value