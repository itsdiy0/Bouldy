"""
Unit tests for chatbot management.
Covers: CRUD, publish toggle, avatar upload, key validation,
document assignment, and tenant isolation.
External services (S3, Qdrant, LLM providers, Redis) are mocked.
"""

import uuid
from unittest.mock import patch, MagicMock

from app.models import Chatbot, Document


# ──────────────────────────────────────────────
#  Create
# ──────────────────────────────────────────────

class TestChatbotCreate:
    """Tests for POST /api/chatbots."""

    def test_create_minimal(self, client, auth_headers):
        """Create a chatbot with just a name."""
        res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "My Bot",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "My Bot"
        assert data["is_public"] == "false"
        assert data["public_token"] is not None
        assert data["document_count"] == 0

    def test_create_with_all_fields(self, client, auth_headers):
        """Create a chatbot with all optional fields."""
        res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Full Bot",
            "description": "A fully configured bot",
            "llm_provider": "openai",
            "llm_model": "gpt-4",
            "api_key": "sk-test-key",
            "accent_primary": "#FF0000",
            "accent_secondary": "#00FF00",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "Full Bot"
        assert data["description"] == "A fully configured bot"
        assert data["llm_provider"] == "openai"
        assert data["llm_model"] == "gpt-4"
        assert data["accent_primary"] == "#FF0000"
        assert data["accent_secondary"] == "#00FF00"

    @patch("app.routers.chatbots.index_chatbot_documents")
    @patch("app.routers.documents.upload_file")
    def test_create_with_documents(self, mock_upload, mock_index, client, auth_headers):
        """Create a chatbot with document assignments."""
        mock_upload.return_value = "fake-key"
        # Upload a doc first
        upload_res = client.post(
            "/api/documents", headers=auth_headers,
            files={"file": ("doc.pdf", b"content", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Doc Bot",
            "document_ids": [doc_id],
        })
        assert res.status_code == 200
        assert res.json()["document_count"] == 1

    def test_create_with_invalid_document(self, client, auth_headers):
        """Create with non-existent document ID returns 400."""
        fake_id = str(uuid.uuid4())
        res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Bad Bot",
            "document_ids": [fake_id],
        })
        assert res.status_code == 400

    def test_create_missing_name(self, client, auth_headers):
        """Create without name returns 422."""
        res = client.post("/api/chatbots", headers=auth_headers, json={})
        assert res.status_code == 422

    def test_create_unauthenticated(self, client):
        """Create without auth returns 422."""
        res = client.post("/api/chatbots", json={"name": "No Auth Bot"})
        assert res.status_code == 422


# ──────────────────────────────────────────────
#  List
# ──────────────────────────────────────────────

class TestChatbotList:
    """Tests for GET /api/chatbots."""

    def test_list_empty(self, client, auth_headers):
        """Empty list when user has no chatbots."""
        res = client.get("/api/chatbots", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["chatbots"] == []
        assert data["total"] == 0

    def test_list_multiple(self, client, auth_headers):
        """Lists all chatbots for the user."""
        for name in ("Bot A", "Bot B", "Bot C"):
            client.post("/api/chatbots", headers=auth_headers, json={"name": name})
        res = client.get("/api/chatbots", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["total"] == 3


# ──────────────────────────────────────────────
#  Get Detail
# ──────────────────────────────────────────────

class TestChatbotDetail:
    """Tests for GET /api/chatbots/{chatbot_id}."""

    def test_get_own_chatbot(self, client, auth_headers):
        """Get detail of own chatbot includes document_ids."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Detail Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.get(f"/api/chatbots/{bot_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "Detail Bot"
        assert "document_ids" in data

    def test_get_nonexistent(self, client, auth_headers):
        """Get non-existent chatbot returns 404."""
        fake_id = str(uuid.uuid4())
        res = client.get(f"/api/chatbots/{fake_id}", headers=auth_headers)
        assert res.status_code == 404


# ──────────────────────────────────────────────
#  Update
# ──────────────────────────────────────────────

class TestChatbotUpdate:
    """Tests for PATCH /api/chatbots/{chatbot_id}."""

    @patch("app.routers.chatbots.clear_chatbot_cache")
    def test_update_name(self, mock_cache, client, auth_headers):
        """Update chatbot name."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Old Name",
        })
        bot_id = create_res.json()["id"]

        res = client.patch(f"/api/chatbots/{bot_id}", headers=auth_headers, json={
            "name": "New Name",
        })
        assert res.status_code == 200
        assert res.json()["name"] == "New Name"

    @patch("app.routers.chatbots.clear_chatbot_cache")
    def test_update_llm_config(self, mock_cache, client, auth_headers):
        """Update LLM provider and model."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "LLM Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.patch(f"/api/chatbots/{bot_id}", headers=auth_headers, json={
            "llm_provider": "anthropic",
            "llm_model": "claude-sonnet-4-20250514",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["llm_provider"] == "anthropic"
        assert data["llm_model"] == "claude-sonnet-4-20250514"

    @patch("app.routers.chatbots.clear_chatbot_cache")
    def test_update_memory_toggle(self, mock_cache, client, auth_headers):
        """Toggle memory enabled."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Memory Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.patch(f"/api/chatbots/{bot_id}", headers=auth_headers, json={
            "memory_enabled": "true",
        })
        assert res.status_code == 200
        assert res.json()["memory_enabled"] == "true"

    def test_update_nonexistent(self, client, auth_headers):
        """Update non-existent chatbot returns 404."""
        fake_id = str(uuid.uuid4())
        res = client.patch(f"/api/chatbots/{fake_id}", headers=auth_headers, json={
            "name": "Ghost",
        })
        assert res.status_code == 404


# ──────────────────────────────────────────────
#  Delete
# ──────────────────────────────────────────────

class TestChatbotDelete:
    """Tests for DELETE /api/chatbots/{chatbot_id}."""

    @patch("app.routers.chatbots.clear_chatbot_cache")
    @patch("app.routers.chatbots.delete_chatbot_index")
    def test_delete_own(self, mock_delete_idx, mock_cache, client, auth_headers):
        """Delete own chatbot succeeds."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Doomed Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.delete(f"/api/chatbots/{bot_id}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["message"] == "Chatbot deleted"

        # Verify gone
        list_res = client.get("/api/chatbots", headers=auth_headers)
        assert list_res.json()["total"] == 0

    def test_delete_nonexistent(self, client, auth_headers):
        """Delete non-existent chatbot returns 404."""
        fake_id = str(uuid.uuid4())
        res = client.delete(f"/api/chatbots/{fake_id}", headers=auth_headers)
        assert res.status_code == 404


# ──────────────────────────────────────────────
#  Publish Toggle
# ──────────────────────────────────────────────

class TestChatbotPublish:
    """Tests for PATCH /api/chatbots/{chatbot_id}/publish."""

    def test_toggle_publish_on(self, client, auth_headers):
        """Toggle publish from false to true."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Public Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.patch(f"/api/chatbots/{bot_id}/publish", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["is_public"] == "true"
        assert data["public_token"] is not None

    def test_toggle_publish_off(self, client, auth_headers):
        """Toggle publish twice returns to false."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Toggle Bot",
        })
        bot_id = create_res.json()["id"]

        # On
        client.patch(f"/api/chatbots/{bot_id}/publish", headers=auth_headers)
        # Off
        res = client.patch(f"/api/chatbots/{bot_id}/publish", headers=auth_headers)
        assert res.json()["is_public"] == "false"

    def test_publish_nonexistent(self, client, auth_headers):
        """Publish non-existent chatbot returns 404."""
        fake_id = str(uuid.uuid4())
        res = client.patch(f"/api/chatbots/{fake_id}/publish", headers=auth_headers)
        assert res.status_code == 404


# ──────────────────────────────────────────────
#  Avatar
# ──────────────────────────────────────────────

class TestChatbotAvatar:
    """Tests for avatar upload and retrieval."""

    @patch("app.routers.chatbots.upload_file")
    def test_upload_avatar(self, mock_upload, client, auth_headers):
        """Upload avatar for own chatbot."""
        mock_upload.return_value = "avatars/fake-key.png"
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Avatar Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.post(
            f"/api/chatbots/{bot_id}/avatar",
            headers=auth_headers,
            files={"file": ("avatar.png", b"fake image bytes", "image/png")},
        )
        assert res.status_code == 200
        assert "avatar_url" in res.json()
        mock_upload.assert_called_once()

    @patch("app.routers.chatbots.upload_file")
    def test_upload_avatar_too_large(self, mock_upload, client, auth_headers):
        """Avatar over 2MB returns 400."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Big Avatar Bot",
        })
        bot_id = create_res.json()["id"]

        large = b"x" * (2 * 1024 * 1024 + 1)
        res = client.post(
            f"/api/chatbots/{bot_id}/avatar",
            headers=auth_headers,
            files={"file": ("huge.png", large, "image/png")},
        )
        assert res.status_code == 400
        mock_upload.assert_not_called()

    def test_upload_avatar_nonexistent_bot(self, client, auth_headers):
        """Avatar upload for non-existent chatbot returns 404."""
        fake_id = str(uuid.uuid4())
        res = client.post(
            f"/api/chatbots/{fake_id}/avatar",
            headers=auth_headers,
            files={"file": ("avatar.png", b"fake", "image/png")},
        )
        assert res.status_code == 404

    @patch("app.routers.chatbots.get_s3_file")
    @patch("app.routers.chatbots.upload_file")
    def test_get_avatar(self, mock_upload, mock_get, client, auth_headers):
        """Retrieve uploaded avatar."""
        mock_upload.return_value = "avatars/fake.png"
        mock_get.return_value = b"fake image bytes"

        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Get Avatar Bot",
        })
        bot_id = create_res.json()["id"]

        # Upload first
        client.post(
            f"/api/chatbots/{bot_id}/avatar",
            headers=auth_headers,
            files={"file": ("avatar.png", b"fake image bytes", "image/png")},
        )

        # Retrieve
        res = client.get(f"/api/chatbots/{bot_id}/avatar")
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/png"

    def test_get_avatar_no_avatar(self, client, auth_headers):
        """Get avatar when none uploaded returns 404."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "No Avatar Bot",
        })
        bot_id = create_res.json()["id"]
        res = client.get(f"/api/chatbots/{bot_id}/avatar")
        assert res.status_code == 404


# ──────────────────────────────────────────────
#  Validate Key
# ──────────────────────────────────────────────

class TestValidateKey:
    """Tests for POST /api/chatbots/validate-key."""

    @patch("app.services.llm_provider.get_llm")
    def test_valid_key(self, mock_llm, client, auth_headers):
        """Valid API key returns valid=true."""
        mock_response = MagicMock()
        mock_response.text = "OK"
        mock_llm.return_value.complete.return_value = mock_response

        res = client.post("/api/chatbots/validate-key", headers=auth_headers, json={
            "provider": "openai",
            "model": "gpt-4",
            "api_key": "sk-valid-key",
        })
        assert res.status_code == 200
        assert res.json()["valid"] is True

    @patch("app.services.llm_provider.get_llm")
    def test_invalid_key(self, mock_llm, client, auth_headers):
        """Invalid API key returns valid=false with error."""
        mock_llm.return_value.complete.side_effect = Exception("401 auth error")

        res = client.post("/api/chatbots/validate-key", headers=auth_headers, json={
            "provider": "openai",
            "model": "gpt-4",
            "api_key": "sk-bad-key",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["valid"] is False
        assert data["error"] is not None


# ──────────────────────────────────────────────
#  Tenant Isolation
# ──────────────────────────────────────────────

class TestChatbotTenantIsolation:
    """Tests ensuring users cannot access each other's chatbots."""

    def test_cannot_list_other_users_bots(self, client, auth_headers, auth_headers_b):
        """User B cannot see User A's chatbots."""
        client.post("/api/chatbots", headers=auth_headers, json={"name": "Secret Bot"})
        res = client.get("/api/chatbots", headers=auth_headers_b)
        assert res.json()["total"] == 0

    def test_cannot_get_other_users_bot(self, client, auth_headers, auth_headers_b):
        """User B cannot access User A's chatbot detail."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={"name": "Private Bot"})
        bot_id = create_res.json()["id"]
        res = client.get(f"/api/chatbots/{bot_id}", headers=auth_headers_b)
        assert res.status_code == 404

    def test_cannot_delete_other_users_bot(self, client, auth_headers, auth_headers_b):
        """User B cannot delete User A's chatbot."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={"name": "Safe Bot"})
        bot_id = create_res.json()["id"]
        res = client.delete(f"/api/chatbots/{bot_id}", headers=auth_headers_b)
        assert res.status_code == 404

        # Still exists for User A
        list_res = client.get("/api/chatbots", headers=auth_headers)
        assert list_res.json()["total"] == 1

    def test_cannot_update_other_users_bot(self, client, auth_headers, auth_headers_b):
        """User B cannot update User A's chatbot."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={"name": "Locked Bot"})
        bot_id = create_res.json()["id"]
        res = client.patch(f"/api/chatbots/{bot_id}", headers=auth_headers_b, json={"name": "Hacked"})
        assert res.status_code == 404