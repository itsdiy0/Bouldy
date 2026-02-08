from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.models import User


def get_current_user(
    x_user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    """
    Get current user from X-User-Id header.
    NextAuth will send this header after validating the session.
    """
    try:
        user_id = UUID(x_user_id)
    except ValueError:
        raise HTTPException(401, "Invalid user ID")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "User not found")
    
    return user