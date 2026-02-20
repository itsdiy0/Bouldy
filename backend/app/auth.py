# Authentication middleware
import logging

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)


# Get current user from X-User-Id header
# NextAuth sends this header after validating the session
def get_current_user(
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    try:
        user_id = UUID(x_user_id)
    except ValueError:
        logger.warning(f"Auth failed: invalid user ID format — {x_user_id}")
        raise HTTPException(401, "Invalid user ID")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning(f"Auth failed: user not found — {x_user_id}")
        raise HTTPException(401, "User not found")

    return user