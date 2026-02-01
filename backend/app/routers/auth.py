from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None

    class Config:
        from_attributes = True


@router.post("/register", response_model=UserResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    # Check if user exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    
    # Create user
    user = User(
        email=data.email,
        password_hash=pwd_context.hash(data.password),
        name=data.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserResponse(id=str(user.id), email=user.email, name=user.name)


@router.post("/login", response_model=UserResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    
    if not user or not pwd_context.verify(data.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    
    return UserResponse(id=str(user.id), email=user.email, name=user.name)