"""
Shared test fixtures for Bouldy backend tests.
Uses SQLite in-memory database for speed and isolation.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import User


# SQLite in-memory engine — shared across a single test session
SQLALCHEMY_TEST_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    """Provide a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """
    FastAPI TestClient with the DB dependency overridden
    to use the SQLite test database.
    """
    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db) -> User:
    """Create and return a test user."""
    from app.routers.auth import hash_password
    user = User(
        email="test@example.com",
        name="Test User",
        password_hash=hash_password("testpass123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_user_b(db) -> User:
    """Create a second test user for tenant isolation tests."""
    from app.routers.auth import hash_password
    user = User(
        email="other@example.com",
        name="Other User",
        password_hash=hash_password("otherpass123"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user) -> dict:
    """Auth headers for the default test user."""
    return {"X-User-Id": str(test_user.id)}


@pytest.fixture
def auth_headers_b(test_user_b) -> dict:
    """Auth headers for the second test user."""
    return {"X-User-Id": str(test_user_b.id)}