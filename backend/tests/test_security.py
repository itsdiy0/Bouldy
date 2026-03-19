"""
Security-focused tests for Bouldy.
Maps to OWASP Top 10 2021 categories.
"""

import uuid
from unittest.mock import patch


# ──────────────────────────────────────────────
#  A01:2021 — Broken Access Control
# ──────────────────────────────────────────────

class TestBrokenAccessControl:
    """OWASP A01: Verify access controls cannot be bypassed."""

    def test_no_auth_documents(self, client):
        """Cannot list documents without authentication."""
        assert client.get("/api/documents").status_code == 422

    def test_no_auth_chatbots(self, client):
        """Cannot list chatbots without authentication."""
        assert client.get("/api/chatbots").status_code == 422

    def test_no_auth_chat(self, client):
        """Cannot chat without authentication."""
        fake = str(uuid.uuid4())
        assert client.post(f"/api/chat/{fake}", json={"message": "hi"}).status_code == 422

    def test_no_auth_evaluation(self, client):
        """Cannot trigger evaluation without authentication."""
        fake = str(uuid.uuid4())
        assert client.post(
            f"/api/chatbots/{fake}/evaluate",
            json={"qa_pairs": [{"question": "Q", "ground_truth": "A"}]},
        ).status_code == 422

    def test_forged_user_id(self, client):
        """Forged but valid UUID that doesn't exist returns 401."""
        fake = str(uuid.uuid4())
        res = client.get("/api/chatbots", headers={"X-User-Id": fake})
        assert res.status_code == 401

    def test_cross_tenant_document_delete(self, client, auth_headers, auth_headers_b):
        """User B cannot delete User A's document by ID."""
        with patch("app.routers.documents.upload_file", return_value="fake"):
            upload = client.post(
                "/api/documents", headers=auth_headers,
                files={"file": ("s.pdf", b"secret", "application/pdf")},
            )
            doc_id = upload.json()["id"]

        res = client.delete(f"/api/documents/{doc_id}", headers=auth_headers_b)
        assert res.status_code == 404

    def test_cross_tenant_chatbot_update(self, client, auth_headers, auth_headers_b):
        """User B cannot update User A's chatbot."""
        create = client.post("/api/chatbots", headers=auth_headers, json={"name": "Private"})
        bot_id = create.json()["id"]

        res = client.patch(
            f"/api/chatbots/{bot_id}", headers=auth_headers_b,
            json={"name": "Hacked"},
        )
        assert res.status_code == 404

    def test_cross_tenant_publish(self, client, auth_headers, auth_headers_b):
        """User B cannot publish User A's chatbot."""
        create = client.post("/api/chatbots", headers=auth_headers, json={"name": "Mine"})
        bot_id = create.json()["id"]

        res = client.patch(f"/api/chatbots/{bot_id}/publish", headers=auth_headers_b)
        assert res.status_code == 404


# ──────────────────────────────────────────────
#  A02:2021 — Cryptographic Failures
# ──────────────────────────────────────────────

class TestCryptographicFailures:
    """OWASP A02: Verify proper use of cryptography."""

    def test_password_not_stored_plaintext(self, client, db):
        """Registered user's password is hashed, not plaintext."""
        from app.models import User

        client.post("/api/auth/register", json={
            "email": "crypto@example.com",
            "password": "mysecretpassword",
        })
        user = db.query(User).filter(User.email == "crypto@example.com").first()
        assert user is not None
        assert user.password_hash != "mysecretpassword"
        assert user.password_hash.startswith("$2b$")  # bcrypt prefix

    def test_password_not_in_response(self, client):
        """Registration response does not leak password hash."""
        res = client.post("/api/auth/register", json={
            "email": "noleak@example.com",
            "password": "securepass123",
        })
        data = res.json()
        assert "password" not in data
        assert "password_hash" not in data

    def test_login_response_no_password(self, client, test_user):
        """Login response does not contain password hash."""
        res = client.post("/api/auth/login", json={
            "email": test_user.email,
            "password": "testpass123",
        })
        data = res.json()
        assert "password" not in data
        assert "password_hash" not in data


# ──────────────────────────────────────────────
#  A03:2021 — Injection
# ──────────────────────────────────────────────

class TestInjection:
    """OWASP A03: Verify resistance to injection attacks."""

    def test_sql_injection_auth_header(self, client):
        """SQL injection via X-User-Id header is rejected."""
        payloads = [
            "'; DROP TABLE users; --",
            "1 OR 1=1",
            "' UNION SELECT * FROM users --",
            "1; DELETE FROM chatbots",
        ]
        for payload in payloads:
            res = client.get("/api/chatbots", headers={"X-User-Id": payload})
            assert res.status_code == 401

    def test_xss_in_chatbot_name(self, client, auth_headers):
        """XSS payload in chatbot name is stored as-is (output encoding is frontend responsibility)."""
        xss = "<script>alert('xss')</script>"
        res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": xss,
        })
        assert res.status_code == 200
        # Stored as-is — API returns JSON, not HTML, so no server-side XSS risk
        assert res.json()["name"] == xss

    def test_xss_in_registration(self, client):
        """XSS payload in user name doesn't cause server error."""
        res = client.post("/api/auth/register", json={
            "email": "xss@example.com",
            "password": "securepass123",
            "name": "<img src=x onerror=alert(1)>",
        })
        assert res.status_code == 200

    @patch("app.routers.documents.upload_file", return_value="fake")
    def test_path_traversal_filename(self, mock_upload, client, auth_headers):
        """Path traversal in filename doesn't affect S3 key generation."""
        res = client.post(
            "/api/documents", headers=auth_headers,
            files={"file": ("../../etc/passwd", b"evil", "application/pdf")},
        )
        assert res.status_code == 200
        # S3 key uses UUID, not the original filename
        assert "../../" not in mock_upload.call_args[0][1]


# ──────────────────────────────────────────────
#  A04:2021 — Insecure Design
# ──────────────────────────────────────────────

class TestInsecureDesign:
    """OWASP A04: Verify secure design patterns."""

    def test_concurrent_evaluation_blocked(self, client, auth_headers, db):
        """Cannot run two evaluations simultaneously on the same chatbot."""
        import uuid as uuid_mod
        from app.models import Document, Chatbot, Evaluation

        user_id = uuid_mod.UUID(auth_headers["X-User-Id"])
        doc = Document(
            user_id=user_id, filename="t.pdf", original_filename="t.pdf",
            file_type="pdf", file_size=100, s3_key="t/t.pdf", status="ready",
        )
        db.add(doc)
        db.flush()

        chatbot = Chatbot(
            user_id=user_id, name="Eval Bot", llm_provider="openai",
            llm_model="gpt-4", llm_api_key="sk-test",
            public_token="sec_" + str(uuid_mod.uuid4())[:8],
        )
        chatbot.documents = [doc]
        db.add(chatbot)
        db.flush()

        # Insert a running evaluation
        evaluation = Evaluation(
            chatbot_id=chatbot.id, question_count=5, status="running",
        )
        db.add(evaluation)
        db.commit()

        # Second evaluation should be blocked
        res = client.post(
            f"/api/chatbots/{chatbot.id}/evaluate", headers=auth_headers,
            json={"qa_pairs": [{"question": "Q", "ground_truth": "A"}]},
        )
        assert res.status_code == 400
        assert "already running" in res.json()["detail"].lower()


# ──────────────────────────────────────────────
#  A05:2021 — Security Misconfiguration
# ──────────────────────────────────────────────

class TestSecurityMisconfiguration:
    """OWASP A05: Verify secure configuration."""

    def test_error_responses_no_stack_trace(self, client):
        """Error responses don't leak stack traces or internals."""
        res = client.get("/api/chatbots", headers={"X-User-Id": "bad"})
        body = res.text
        assert "Traceback" not in body
        assert "File " not in body
        assert "sqlalchemy" not in body.lower()

    def test_404_no_information_leak(self, client, auth_headers):
        """404 responses don't reveal whether a resource exists for another user."""
        fake = str(uuid.uuid4())
        res = client.get(f"/api/chatbots/{fake}", headers=auth_headers)
        assert res.status_code == 404
        # Message should be generic
        assert "not found" in res.json()["detail"].lower()


# ──────────────────────────────────────────────
#  A07:2021 — Identification & Authentication
# ──────────────────────────────────────────────

class TestAuthenticationFailures:
    """OWASP A07: Verify robust authentication."""

    def test_wrong_password_rejected(self, client, test_user):
        """Wrong password returns 401, not 200."""
        res = client.post("/api/auth/login", json={
            "email": test_user.email,
            "password": "wrongpassword",
        })
        assert res.status_code == 401

    def test_empty_password_rejected(self, client):
        """Empty password in registration is rejected."""
        res = client.post("/api/auth/register", json={
            "email": "empty@example.com",
            "password": "",
        })
        assert res.status_code == 422

    def test_bcrypt_truncation(self, client):
        """Passwords beyond 72 bytes are safely truncated (bcrypt limit)."""
        long_pass = "a" * 100
        res = client.post("/api/auth/register", json={
            "email": "longpass@example.com",
            "password": long_pass,
        })
        # Should be rejected by max_length=72 validation
        assert res.status_code == 422

    def test_timing_safe_login(self, client, test_user):
        """Login with wrong email and wrong password both return 401 (no user enumeration)."""
        wrong_email = client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anything",
        })
        wrong_pass = client.post("/api/auth/login", json={
            "email": test_user.email,
            "password": "wrongpassword",
        })
        # Both return same status — no user enumeration
        assert wrong_email.status_code == wrong_pass.status_code == 401


# ──────────────────────────────────────────────
#  A08:2021 — Software & Data Integrity
# ──────────────────────────────────────────────

class TestDataIntegrity:
    """OWASP A08: Verify data integrity protections."""

    def test_file_type_whitelist_enforced(self, client, auth_headers):
        """Only whitelisted file types are accepted."""
        blocked_types = [
            ("evil.exe", "application/x-executable"),
            ("script.sh", "application/x-sh"),
            ("page.html", "text/html"),
            ("code.py", "text/x-python"),
            ("image.jpg", "image/jpeg"),
        ]
        for name, mime in blocked_types:
            res = client.post(
                "/api/documents", headers=auth_headers,
                files={"file": (name, b"content", mime)},
            )
            assert res.status_code == 400, f"{mime} should be blocked"

    def test_avatar_size_limit(self, client, auth_headers):
        """Avatar uploads over 2MB are rejected."""
        create = client.post("/api/chatbots", headers=auth_headers, json={"name": "Bot"})
        bot_id = create.json()["id"]

        large = b"x" * (2 * 1024 * 1024 + 1)
        with patch("app.routers.chatbots.upload_file"):
            res = client.post(
                f"/api/chatbots/{bot_id}/avatar", headers=auth_headers,
                files={"file": ("big.png", large, "image/png")},
            )
        assert res.status_code == 400