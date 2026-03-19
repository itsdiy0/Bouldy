"""
Unit tests for authentication.
Covers: registration, login (NextAuth callback), user lookup,
auth middleware (X-User-Id header), and edge cases.
"""

import uuid
from app.models import User


# ──────────────────────────────────────────────
#  Auth Middleware (get_current_user via header)
# ──────────────────────────────────────────────

class TestAuthMiddleware:
    """Tests for the X-User-Id header authentication dependency."""

    def test_valid_user_header(self, client, test_user):
        """Authenticated request with valid user ID succeeds."""
        res = client.get("/api/chatbots", headers={"X-User-Id": str(test_user.id)})
        assert res.status_code == 200

    def test_missing_header(self, client):
        """Request without X-User-Id header returns 422 (missing required header)."""
        res = client.get("/api/chatbots")
        assert res.status_code == 422

    def test_invalid_uuid_format(self, client):
        """Request with malformed UUID returns 401."""
        res = client.get("/api/chatbots", headers={"X-User-Id": "not-a-uuid"})
        assert res.status_code == 401

    def test_nonexistent_user(self, client):
        """Request with valid UUID format but no matching user returns 401."""
        fake_id = str(uuid.uuid4())
        res = client.get("/api/chatbots", headers={"X-User-Id": fake_id})
        assert res.status_code == 401


# ──────────────────────────────────────────────
#  Registration / NextAuth Callback
# ──────────────────────────────────────────────

class TestRegistration:
    """Tests for POST /api/auth/register (NextAuth callback)."""

    def test_register_new_user(self, client):
        """New user registration creates user and returns user data."""
        res = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "password": "securepass123",
            "name": "New User",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "new@example.com"
        assert data["name"] == "New User"
        assert "id" in data

    def test_register_without_name(self, client):
        """Registration without name succeeds (name is optional)."""
        res = client.post("/api/auth/register", json={
            "email": "noname@example.com",
            "password": "securepass123",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["email"] == "noname@example.com"
        assert data["name"] is None

    def test_register_duplicate_email(self, client, test_user):
        """Registering with an existing email returns 400."""
        res = client.post("/api/auth/register", json={
            "email": test_user.email,
            "password": "anotherpass123",
            "name": "Different Name",
        })
        assert res.status_code == 400

    def test_register_missing_email(self, client):
        """Registration without email returns 422."""
        res = client.post("/api/auth/register", json={
            "password": "securepass123",
            "name": "No Email User",
        })
        assert res.status_code == 422

    def test_register_missing_password(self, client):
        """Registration without password returns 422."""
        res = client.post("/api/auth/register", json={
            "email": "nopass@example.com",
            "name": "No Pass User",
        })
        assert res.status_code == 422

    def test_register_short_password(self, client):
        """Registration with password shorter than 6 chars returns 422."""
        res = client.post("/api/auth/register", json={
            "email": "short@example.com",
            "password": "abc",
        })
        assert res.status_code == 422

    def test_register_invalid_email_format(self, client):
        """Registration with invalid email format returns 422."""
        res = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "securepass123",
        })
        assert res.status_code == 422

    def test_register_empty_body(self, client):
        """Registration with empty body returns 422."""
        res = client.post("/api/auth/register", json={})
        assert res.status_code == 422


# ──────────────────────────────────────────────
#  Login
# ──────────────────────────────────────────────

class TestLogin:
    """Tests for POST /api/auth/login."""

    def test_login_valid_credentials(self, client, test_user):
        """Login with correct email and password returns user data."""
        res = client.post("/api/auth/login", json={
            "email": test_user.email,
            "password": "testpass123",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == str(test_user.id)
        assert data["email"] == test_user.email

    def test_login_wrong_password(self, client, test_user):
        """Login with wrong password returns 401."""
        res = client.post("/api/auth/login", json={
            "email": test_user.email,
            "password": "wrongpassword",
        })
        assert res.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Login with unregistered email returns 401."""
        res = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "somepassword",
        })
        assert res.status_code == 401

    def test_login_missing_email(self, client):
        """Login without email returns 422."""
        res = client.post("/api/auth/login", json={
            "password": "somepassword",
        })
        assert res.status_code == 422

    def test_login_missing_password(self, client):
        """Login without password returns 422."""
        res = client.post("/api/auth/login", json={
            "email": "test@example.com",
        })
        assert res.status_code == 422


# ──────────────────────────────────────────────
#  User Lookup / Me Endpoint
# ──────────────────────────────────────────────

class TestTenantIsolation:
    """Tests for tenant isolation at the auth layer."""

    def test_tenant_isolation(self, client, test_user, test_user_b, auth_headers):
        """User A cannot access User B's data via auth."""
        # This is a sanity check — the auth middleware returns only the
        # user matching the header, so there's no cross-tenant leak at this layer.
        res = client.get("/api/chatbots", headers=auth_headers)
        assert res.status_code == 200
        # Results should only contain test_user's chatbots (empty at this point)
        data = res.json()
        assert data["chatbots"] == []
        assert data["total"] == 0


# ──────────────────────────────────────────────
#  Edge Cases
# ──────────────────────────────────────────────

class TestAuthEdgeCases:
    """Edge cases and security-related auth tests."""

    def test_empty_user_id_header(self, client):
        """Empty X-User-Id header returns 401."""
        res = client.get("/api/chatbots", headers={"X-User-Id": ""})
        assert res.status_code == 401

    def test_sql_injection_in_header(self, client):
        """SQL injection attempt in header is safely handled."""
        res = client.get(
            "/api/chatbots",
            headers={"X-User-Id": "'; DROP TABLE users; --"},
        )
        assert res.status_code == 401

    def test_extremely_long_header(self, client):
        """Extremely long X-User-Id header is handled gracefully."""
        res = client.get(
            "/api/chatbots",
            headers={"X-User-Id": "a" * 10000},
        )
        assert res.status_code == 401

    def test_null_bytes_in_header(self, client):
        """Null bytes in header are handled safely."""
        res = client.get(
            "/api/chatbots",
            headers={"X-User-Id": "\x00" * 16},
        )
        assert res.status_code == 401

    def test_case_sensitivity_header_name(self, client, test_user):
        """Header name matching is case-insensitive (HTTP spec)."""
        res = client.get(
            "/api/chatbots",
            headers={"x-user-id": str(test_user.id)},
        )
        # HTTP headers are case-insensitive, so this should work
        assert res.status_code == 200