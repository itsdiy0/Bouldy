"""
Integration tests for Bouldy.
End-to-end flows testing multiple endpoints together
to verify the full user journey works correctly.
"""

import uuid
from unittest.mock import patch, MagicMock


# ──────────────────────────────────────────────
#  User Journey: Register → Create → Chat
# ──────────────────────────────────────────────

class TestUserJourney:
    """Full user journey: register, create chatbot, upload doc, chat."""

    @patch("app.routers.chat.cache_response")
    @patch("app.routers.chat.get_cached_response", return_value=None)
    @patch("app.routers.chat.get_llm")
    @patch("app.routers.chat.load_chatbot_index")
    @patch("app.routers.chatbots.index_chatbot_documents")
    @patch("app.routers.documents.upload_file")
    def test_full_flow(
        self, mock_upload, mock_index, mock_load_idx, mock_llm,
        mock_cache_get, mock_cache_set, client
    ):
        """Register → upload doc → create chatbot with doc → chat."""
        mock_upload.return_value = "fake-key"

        # 1. Register
        reg_res = client.post("/api/auth/register", json={
            "email": "journey@example.com",
            "password": "securepass123",
            "name": "Journey User",
        })
        assert reg_res.status_code == 200
        user_id = reg_res.json()["id"]
        headers = {"X-User-Id": user_id}

        # 2. Upload document
        doc_res = client.post(
            "/api/documents", headers=headers,
            files={"file": ("guide.pdf", b"PDF content here", "application/pdf")},
        )
        assert doc_res.status_code == 200
        doc_id = doc_res.json()["id"]
        assert doc_res.json()["status"] == "uploaded"

        # 3. Create chatbot with document
        bot_res = client.post("/api/chatbots", headers=headers, json={
            "name": "My Assistant",
            "description": "Helps with the guide",
            "llm_provider": "openai",
            "llm_model": "gpt-4",
            "api_key": "sk-test",
            "document_ids": [doc_id],
        })
        assert bot_res.status_code == 200
        bot_id = bot_res.json()["id"]
        assert bot_res.json()["document_count"] == 1

        # 4. Chat with the chatbot
        mock_source = MagicMock()
        mock_source.score = 0.9
        mock_source.text = "Relevant content from guide"
        mock_source.metadata = {"filename": "guide.pdf", "document_id": doc_id, "page": 1}

        mock_response = MagicMock()
        mock_response.__str__ = lambda self: "Here's what the guide says..."
        mock_response.source_nodes = [mock_source]

        mock_qe = MagicMock()
        mock_qe.query.return_value = mock_response
        mock_load_idx.return_value.as_query_engine.return_value = mock_qe

        chat_res = client.post(f"/api/chat/{bot_id}", headers=headers, json={
            "message": "What does the guide say?",
        })
        assert chat_res.status_code == 200
        data = chat_res.json()
        assert "response" in data
        assert "session_id" in data
        assert len(data["sources"]) > 0

    @patch("app.routers.chat.cache_response")
    @patch("app.routers.chat.get_cached_response", return_value=None)
    @patch("app.routers.chat.get_llm")
    @patch("app.routers.chat.load_chatbot_index")
    @patch("app.routers.documents.upload_file")
    def test_multi_session_chat(
        self, mock_upload, mock_load_idx, mock_llm,
        mock_cache_get, mock_cache_set, client, auth_headers
    ):
        """Create chatbot, chat in multiple sessions, verify isolation."""
        mock_upload.return_value = "fake-key"

        # Create chatbot
        bot_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Session Bot",
            "llm_provider": "openai",
            "llm_model": "gpt-4",
            "api_key": "sk-test",
        })
        bot_id = bot_res.json()["id"]

        # Mock query engine
        mock_response = MagicMock()
        mock_response.__str__ = lambda self: "Answer"
        mock_response.source_nodes = []
        mock_qe = MagicMock()
        mock_qe.query.return_value = mock_response
        mock_load_idx.return_value.as_query_engine.return_value = mock_qe

        # First chat — creates session 1
        chat1 = client.post(f"/api/chat/{bot_id}", headers=auth_headers, json={
            "message": "First question",
        })
        assert chat1.status_code == 200
        session1_id = chat1.json()["session_id"]

        # Second chat — creates session 2
        chat2 = client.post(f"/api/chat/{bot_id}", headers=auth_headers, json={
            "message": "Different topic",
        })
        assert chat2.status_code == 200
        session2_id = chat2.json()["session_id"]

        # Sessions should be different
        assert session1_id != session2_id

        # Verify both sessions are valid UUIDs
        import uuid as uuid_mod
        uuid_mod.UUID(session1_id)
        uuid_mod.UUID(session2_id)


# ──────────────────────────────────────────────
#  Chatbot Lifecycle
# ──────────────────────────────────────────────

class TestChatbotLifecycle:
    """Full chatbot lifecycle: create → configure → publish → delete."""

    @patch("app.routers.chatbots.clear_chatbot_cache")
    @patch("app.routers.chatbots.delete_chatbot_index")
    @patch("app.routers.chatbots.upload_file")
    def test_full_lifecycle(
        self, mock_s3_upload, mock_delete_idx, mock_cache, client, auth_headers
    ):
        """Create → update → upload avatar → publish → unpublish → delete."""
        mock_s3_upload.return_value = "avatars/fake.png"

        # 1. Create
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Lifecycle Bot",
        })
        assert create_res.status_code == 200
        bot_id = create_res.json()["id"]
        assert create_res.json()["is_public"] == "false"

        # 2. Update with LLM config and branding
        update_res = client.patch(f"/api/chatbots/{bot_id}", headers=auth_headers, json={
            "name": "Updated Bot",
            "llm_provider": "anthropic",
            "llm_model": "claude-sonnet-4-20250514",
            "accent_primary": "#10B981",
            "accent_secondary": "#1F2937",
        })
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "Updated Bot"
        assert update_res.json()["accent_primary"] == "#10B981"

        # 3. Upload avatar
        avatar_res = client.post(
            f"/api/chatbots/{bot_id}/avatar", headers=auth_headers,
            files={"file": ("bot.png", b"fake image", "image/png")},
        )
        assert avatar_res.status_code == 200

        # 4. Publish
        pub_res = client.patch(f"/api/chatbots/{bot_id}/publish", headers=auth_headers)
        assert pub_res.status_code == 200
        assert pub_res.json()["is_public"] == "true"
        public_token = pub_res.json()["public_token"]
        assert public_token is not None

        # 5. Verify detail shows everything
        detail_res = client.get(f"/api/chatbots/{bot_id}", headers=auth_headers)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["name"] == "Updated Bot"
        assert detail["llm_provider"] == "anthropic"
        assert detail["is_public"] == "true"

        # 6. Unpublish
        unpub_res = client.patch(f"/api/chatbots/{bot_id}/publish", headers=auth_headers)
        assert unpub_res.json()["is_public"] == "false"

        # 7. Delete
        del_res = client.delete(f"/api/chatbots/{bot_id}", headers=auth_headers)
        assert del_res.status_code == 200

        # 8. Verify gone
        list_res = client.get("/api/chatbots", headers=auth_headers)
        assert list_res.json()["total"] == 0


# ──────────────────────────────────────────────
#  Document Lifecycle
# ──────────────────────────────────────────────

class TestDocumentLifecycle:
    """Full document lifecycle with chatbot assignment."""

    @patch("app.routers.chatbots.clear_chatbot_cache")
    @patch("app.routers.chatbots.index_chatbot_documents")
    @patch("app.routers.chatbots.delete_chatbot_index")
    @patch("app.routers.documents.delete_file")
    @patch("app.routers.documents.upload_file")
    def test_upload_assign_reassign_delete(
        self, mock_upload, mock_delete_file, mock_delete_idx,
        mock_index, mock_cache, client, auth_headers
    ):
        """Upload docs → assign to chatbot → reassign → delete doc."""
        mock_upload.return_value = "fake-key"

        # Upload two documents
        doc1_res = client.post(
            "/api/documents", headers=auth_headers,
            files={"file": ("a.pdf", b"doc A", "application/pdf")},
        )
        doc2_res = client.post(
            "/api/documents", headers=auth_headers,
            files={"file": ("b.txt", b"doc B", "text/plain")},
        )
        doc1_id = doc1_res.json()["id"]
        doc2_id = doc2_res.json()["id"]

        # Create chatbot with doc1
        bot_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Doc Bot",
            "document_ids": [doc1_id],
        })
        bot_id = bot_res.json()["id"]
        assert bot_res.json()["document_count"] == 1

        # Reassign to both docs
        update_res = client.patch(f"/api/chatbots/{bot_id}", headers=auth_headers, json={
            "document_ids": [doc1_id, doc2_id],
        })
        assert update_res.status_code == 200
        assert update_res.json()["document_count"] == 2

        # Delete doc1
        client.delete(f"/api/documents/{doc1_id}", headers=auth_headers)

        # Verify doc list
        list_res = client.get("/api/documents", headers=auth_headers)
        assert list_res.json()["total"] == 1
        assert list_res.json()["documents"][0]["id"] == doc2_id


# ──────────────────────────────────────────────
#  Multi-Tenant Isolation (E2E)
# ──────────────────────────────────────────────

class TestMultiTenantIsolation:
    """End-to-end tenant isolation across all resources."""

    @patch("app.routers.documents.upload_file")
    def test_complete_isolation(self, mock_upload, client, auth_headers, auth_headers_b):
        """Two users operate independently with zero data leakage."""
        mock_upload.return_value = "fake-key"

        # User A creates resources
        client.post(
            "/api/documents", headers=auth_headers,
            files={"file": ("a.pdf", b"secret A", "application/pdf")},
        )
        client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Bot A",
        })

        # User B creates resources
        client.post(
            "/api/documents", headers=auth_headers_b,
            files={"file": ("b.pdf", b"secret B", "application/pdf")},
        )
        client.post("/api/chatbots", headers=auth_headers_b, json={
            "name": "Bot B",
        })

        # User A sees only their stuff
        a_docs = client.get("/api/documents", headers=auth_headers).json()
        a_bots = client.get("/api/chatbots", headers=auth_headers).json()
        assert a_docs["total"] == 1
        assert a_bots["total"] == 1
        assert a_bots["chatbots"][0]["name"] == "Bot A"

        # User B sees only their stuff
        b_docs = client.get("/api/documents", headers=auth_headers_b).json()
        b_bots = client.get("/api/chatbots", headers=auth_headers_b).json()
        assert b_docs["total"] == 1
        assert b_bots["total"] == 1
        assert b_bots["chatbots"][0]["name"] == "Bot B"

        # Cross-access attempts fail
        a_bot_id = a_bots["chatbots"][0]["id"]
        b_bot_id = b_bots["chatbots"][0]["id"]

        assert client.get(f"/api/chatbots/{a_bot_id}", headers=auth_headers_b).status_code == 404
        assert client.get(f"/api/chatbots/{b_bot_id}", headers=auth_headers).status_code == 404
        assert client.delete(f"/api/chatbots/{a_bot_id}", headers=auth_headers_b).status_code == 404
        assert client.patch(
            f"/api/chatbots/{a_bot_id}", headers=auth_headers_b, json={"name": "Hacked"}
        ).status_code == 404