"""
Unit tests for the RAG pipeline.
Covers: document parsing, indexing helpers, chat endpoints,
cache service, and evaluation endpoints.
All external services (Qdrant, OpenAI, Redis, S3, LLMs) are mocked.
"""

import uuid
import json
from unittest.mock import patch, MagicMock

from app.models import Chatbot, Document
from app.services.indexing import (
    parse_pdf_pages, parse_txt, get_collection_name,
)


# ──────────────────────────────────────────────
#  Document Parsing (pure functions, no mocking)
# ──────────────────────────────────────────────

class TestDocumentParsing:
    """Tests for text extraction from different file formats."""

    def test_parse_txt(self):
        """Parse plain text bytes."""
        content = b"Hello, this is a test document."
        result = parse_txt(content)
        assert result == "Hello, this is a test document."

    def test_parse_txt_utf8(self):
        """Parse UTF-8 encoded text with special characters."""
        content = "Héllo wörld — café".encode("utf-8")
        result = parse_txt(content)
        assert "Héllo" in result
        assert "café" in result

    def test_parse_txt_empty(self):
        """Parse empty text file."""
        result = parse_txt(b"")
        assert result == ""

    def test_parse_pdf_pages_returns_list(self):
        """PDF parser returns list of page dicts (mocked)."""
        with patch("pypdf.PdfReader") as mock_reader:
            mock_page = MagicMock()
            mock_page.extract_text.return_value = "Page 1 content"
            mock_reader.return_value.pages = [mock_page]

            result = parse_pdf_pages(b"fake pdf bytes")
            assert len(result) == 1
            assert result[0]["text"] == "Page 1 content"
            assert result[0]["page"] == 1

    def test_parse_pdf_skips_empty_pages(self):
        """PDF parser skips pages with no text."""
        with patch("pypdf.PdfReader") as mock_reader:
            page1 = MagicMock()
            page1.extract_text.return_value = "Has content"
            page2 = MagicMock()
            page2.extract_text.return_value = "   "
            page3 = MagicMock()
            page3.extract_text.return_value = "Also has content"
            mock_reader.return_value.pages = [page1, page2, page3]

            result = parse_pdf_pages(b"fake pdf")
            assert len(result) == 2
            assert result[0]["page"] == 1
            assert result[1]["page"] == 3


# ──────────────────────────────────────────────
#  Indexing Helpers
# ──────────────────────────────────────────────

class TestIndexingHelpers:
    """Tests for indexing utility functions."""

    def test_collection_name_format(self):
        """Collection name follows chatbot_{uuid} pattern."""
        cid = uuid.uuid4()
        name = get_collection_name(cid)
        assert name == f"chatbot_{str(cid)}"

    def test_collection_name_unique(self):
        """Different chatbot IDs produce different collection names."""
        a = get_collection_name(uuid.uuid4())
        b = get_collection_name(uuid.uuid4())
        assert a != b


# ──────────────────────────────────────────────
#  Chat Endpoint
# ──────────────────────────────────────────────

class TestChatEndpoint:
    """Tests for POST /api/chat/{chatbot_id}."""

    def _create_configured_chatbot(self, client, auth_headers):
        """Helper: create a chatbot with LLM configured."""
        res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Chat Bot",
            "llm_provider": "openai",
            "llm_model": "gpt-4",
            "api_key": "sk-test",
        })
        return res.json()["id"]

    def test_chat_missing_auth(self, client):
        """Chat without auth returns 422."""
        fake_id = str(uuid.uuid4())
        res = client.post(f"/api/chat/{fake_id}", json={"message": "hello"})
        assert res.status_code == 422

    def test_chat_nonexistent_chatbot(self, client, auth_headers):
        """Chat with non-existent chatbot returns 404."""
        fake_id = str(uuid.uuid4())
        res = client.post(
            f"/api/chat/{fake_id}",
            headers=auth_headers,
            json={"message": "hello"},
        )
        assert res.status_code == 404

    def test_chat_no_llm_configured(self, client, auth_headers):
        """Chat with chatbot that has no LLM returns 400."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "No LLM Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.post(
            f"/api/chat/{bot_id}",
            headers=auth_headers,
            json={"message": "hello"},
        )
        assert res.status_code == 400

    @patch("app.routers.chat.cache_response")
    @patch("app.routers.chat.get_cached_response", return_value=None)
    @patch("app.routers.chat.get_llm")
    @patch("app.routers.chat.load_chatbot_index")
    def test_chat_success(self, mock_index, mock_llm, mock_cache_get, mock_cache_set, client, auth_headers):
        """Successful chat returns response with sources and session."""
        # Mock the query engine
        mock_source = MagicMock()
        mock_source.score = 0.85
        mock_source.text = "Relevant document chunk"
        mock_source.metadata = {"filename": "doc.pdf", "document_id": "abc", "page": 1}

        mock_response = MagicMock()
        mock_response.__str__ = lambda self: "This is the AI response"
        mock_response.source_nodes = [mock_source]

        mock_query_engine = MagicMock()
        mock_query_engine.query.return_value = mock_response
        mock_index.return_value.as_query_engine.return_value = mock_query_engine

        bot_id = self._create_configured_chatbot(client, auth_headers)

        res = client.post(
            f"/api/chat/{bot_id}",
            headers=auth_headers,
            json={"message": "What is this about?"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "response" in data
        assert "sources" in data
        assert "session_id" in data

    @patch("app.routers.chat.cache_response")
    @patch("app.routers.chat.get_cached_response")
    def test_chat_cache_hit(self, mock_cache_get, mock_cache_set, client, auth_headers):
        """Cached response is returned without hitting the LLM."""
        mock_cache_get.return_value = {
            "response": "Cached answer",
            "sources": [{"text": "cached source", "score": 0.9, "filename": "doc.pdf"}],
        }

        bot_id = self._create_configured_chatbot(client, auth_headers)

        res = client.post(
            f"/api/chat/{bot_id}",
            headers=auth_headers,
            json={"message": "cached question"},
        )
        assert res.status_code == 200
        assert res.json()["response"] == "Cached answer"

    def test_chat_tenant_isolation(self, client, auth_headers, auth_headers_b):
        """User B cannot chat with User A's chatbot."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "Private Chat Bot",
            "llm_provider": "openai",
            "llm_model": "gpt-4",
            "api_key": "sk-test",
        })
        bot_id = create_res.json()["id"]

        res = client.post(
            f"/api/chat/{bot_id}",
            headers=auth_headers_b,
            json={"message": "hello"},
        )
        assert res.status_code == 404


# ──────────────────────────────────────────────
#  Chat Helpers
# ──────────────────────────────────────────────

class TestChatHelpers:
    """Tests for chat utility functions."""

    def test_extract_sources_filters_low_scores(self):
        """Sources below threshold are excluded."""
        from app.routers.chat import extract_sources

        low = MagicMock()
        low.score = 0.1
        low.text = "Irrelevant"
        low.metadata = {"filename": "a.pdf"}

        high = MagicMock()
        high.score = 0.8
        high.text = "Relevant chunk"
        high.metadata = {"filename": "b.pdf", "document_id": "x", "page": 2}

        sources = extract_sources([low, high])
        assert len(sources) == 1
        assert sources[0]["filename"] == "b.pdf"

    def test_trim_to_sentences(self):
        """Trimming respects sentence boundaries."""
        from app.routers.chat import trim_to_sentences

        short = "Short text."
        assert trim_to_sentences(short) == "Short text."

        long = "First sentence. " * 30
        result = trim_to_sentences(long, max_length=100)
        assert len(result) <= 101  # boundary + period
        assert result.endswith(".")


# ──────────────────────────────────────────────
#  Cache Service
# ──────────────────────────────────────────────

class TestCacheService:
    """Tests for Redis-based semantic cache (mocked)."""

    @patch("app.services.cache.get_redis_client")
    @patch("app.services.cache.get_query_embedding", return_value=[0.1] * 128)
    def test_cache_miss(self, mock_embed, mock_redis, ):
        """Cache miss returns None."""
        from app.services.cache import get_cached_response

        mock_r = MagicMock()
        mock_r.keys.return_value = []
        mock_redis.return_value = mock_r

        result = get_cached_response("bot-123", "some question")
        assert result is None

    @patch("app.services.cache.get_redis_client")
    @patch("app.services.cache.get_query_embedding", return_value=[1.0] * 128)
    def test_cache_hit(self, mock_embed, mock_redis):
        """Cache hit returns stored response."""
        from app.services.cache import get_cached_response

        cached_data = json.dumps({
            "embedding": [1.0] * 128,
            "response": "Cached answer",
            "sources": [],
        })

        mock_r = MagicMock()
        mock_r.keys.return_value = ["cache:bot-123:abc"]
        mock_r.get.return_value = cached_data
        mock_redis.return_value = mock_r

        result = get_cached_response("bot-123", "some question")
        assert result is not None
        assert result["response"] == "Cached answer"

    @patch("app.services.cache.get_redis_client")
    @patch("app.services.cache.get_query_embedding", return_value=[0.1] * 128)
    def test_cache_store(self, mock_embed, mock_redis):
        """Storing a response calls Redis setex."""
        from app.services.cache import cache_response

        mock_r = MagicMock()
        mock_redis.return_value = mock_r

        cache_response("bot-123", "question", "answer", [])
        mock_r.setex.assert_called_once()

    @patch("app.services.cache.get_redis_client")
    def test_clear_cache(self, mock_redis):
        """Clearing cache deletes all keys for a chatbot."""
        from app.services.cache import clear_chatbot_cache

        mock_r = MagicMock()
        mock_r.keys.return_value = ["cache:bot-123:a", "cache:bot-123:b"]
        mock_redis.return_value = mock_r

        clear_chatbot_cache("bot-123")
        mock_r.delete.assert_called_once_with("cache:bot-123:a", "cache:bot-123:b")

    @patch("app.services.cache.get_redis_client")
    def test_cache_failure_graceful(self, mock_redis):
        """Cache failure doesn't raise — returns None."""
        from app.services.cache import get_cached_response

        mock_redis.side_effect = Exception("Redis down")
        result = get_cached_response("bot-123", "question")
        assert result is None


# ──────────────────────────────────────────────
#  Evaluation Endpoints
# ──────────────────────────────────────────────

class TestEvaluationEndpoints:
    """Tests for the RAGAS evaluation API layer (not the background task)."""

    def _create_chatbot_with_docs(self, client, auth_headers, db):
        """Helper: create a chatbot with a document attached."""
        import uuid as uuid_mod

        # Get user UUID as a proper UUID object (SQLite needs this)
        user_id = uuid_mod.UUID(auth_headers["X-User-Id"])

        doc = Document(
            user_id=user_id,
            filename="test.pdf",
            original_filename="test.pdf",
            file_type="pdf",
            file_size=1000,
            s3_key=f"{user_id}/test.pdf",
            status="ready",
        )
        db.add(doc)
        db.flush()

        chatbot = Chatbot(
            user_id=user_id,
            name="Eval Bot",
            llm_provider="openai",
            llm_model="gpt-4",
            llm_api_key="sk-test",
            public_token="token_" + str(uuid_mod.uuid4())[:8],
        )
        chatbot.documents = [doc]
        db.add(chatbot)
        db.commit()
        db.refresh(chatbot)
        return str(chatbot.id)

    @patch("app.routers.evaluation.run_evaluation_task")
    def test_start_evaluation(self, mock_eval_task, client, auth_headers, db):
        """Starting an evaluation creates a run and returns 200."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)

        res = client.post(
            f"/api/chatbots/{bot_id}/evaluate",
            headers=auth_headers,
            json={"qa_pairs": [
                {"question": "What is this?", "ground_truth": "A test document"},
            ]},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "running"
        assert data["question_count"] == 1

    def test_start_evaluation_no_qa(self, client, auth_headers, db):
        """Starting evaluation with empty Q&A returns 400."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)

        res = client.post(
            f"/api/chatbots/{bot_id}/evaluate",
            headers=auth_headers,
            json={"qa_pairs": []},
        )
        assert res.status_code == 400

    def test_start_evaluation_no_llm(self, client, auth_headers):
        """Starting evaluation on chatbot without LLM returns 400."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "No LLM Bot",
        })
        bot_id = create_res.json()["id"]

        res = client.post(
            f"/api/chatbots/{bot_id}/evaluate",
            headers=auth_headers,
            json={"qa_pairs": [
                {"question": "Q?", "ground_truth": "A"},
            ]},
        )
        assert res.status_code == 400

    def test_start_evaluation_no_docs(self, client, auth_headers):
        """Starting evaluation on chatbot without docs returns 400."""
        create_res = client.post("/api/chatbots", headers=auth_headers, json={
            "name": "No Docs Bot",
            "llm_provider": "openai",
            "llm_model": "gpt-4",
            "api_key": "sk-test",
        })
        bot_id = create_res.json()["id"]

        res = client.post(
            f"/api/chatbots/{bot_id}/evaluate",
            headers=auth_headers,
            json={"qa_pairs": [
                {"question": "Q?", "ground_truth": "A"},
            ]},
        )
        assert res.status_code == 400

    def test_list_evaluations_empty(self, client, auth_headers, db):
        """List evaluations returns empty list when none exist."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)

        res = client.get(f"/api/chatbots/{bot_id}/evaluate", headers=auth_headers)
        assert res.status_code == 200
        assert res.json() == []

    @patch("app.routers.evaluation.run_evaluation_task")
    def test_list_evaluations(self, mock_eval_task, client, auth_headers, db):
        """List evaluations returns runs after creating one."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)

        # Create an evaluation run
        client.post(
            f"/api/chatbots/{bot_id}/evaluate",
            headers=auth_headers,
            json={"qa_pairs": [
                {"question": "Q?", "ground_truth": "A"},
            ]},
        )

        res = client.get(f"/api/chatbots/{bot_id}/evaluate", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.json()) == 1

    @patch("app.routers.evaluation.run_evaluation_task")
    def test_get_evaluation_detail(self, mock_eval_task, client, auth_headers, db):
        """Get evaluation detail returns run with results."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)

        start_res = client.post(
            f"/api/chatbots/{bot_id}/evaluate",
            headers=auth_headers,
            json={"qa_pairs": [
                {"question": "Q?", "ground_truth": "A"},
            ]},
        )
        eval_id = start_res.json()["id"]

        res = client.get(f"/api/chatbots/{bot_id}/evaluate/{eval_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == eval_id
        assert "results" in data

    def test_get_evaluation_nonexistent(self, client, auth_headers, db):
        """Get non-existent evaluation returns 404."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)
        fake_id = str(uuid.uuid4())

        res = client.get(f"/api/chatbots/{bot_id}/evaluate/{fake_id}", headers=auth_headers)
        assert res.status_code == 404

    @patch("app.routers.evaluation.run_evaluation_task")
    def test_delete_evaluation(self, mock_eval_task, client, auth_headers, db):
        """Delete evaluation removes the run."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)

        start_res = client.post(
            f"/api/chatbots/{bot_id}/evaluate",
            headers=auth_headers,
            json={"qa_pairs": [
                {"question": "Q?", "ground_truth": "A"},
            ]},
        )
        eval_id = start_res.json()["id"]

        res = client.delete(f"/api/chatbots/{bot_id}/evaluate/{eval_id}", headers=auth_headers)
        assert res.status_code == 200

        # Verify gone
        list_res = client.get(f"/api/chatbots/{bot_id}/evaluate", headers=auth_headers)
        assert len(list_res.json()) == 0

    def test_evaluation_tenant_isolation(self, client, auth_headers, auth_headers_b, db):
        """User B cannot access User A's evaluations."""
        bot_id = self._create_chatbot_with_docs(client, auth_headers, db)

        res = client.get(f"/api/chatbots/{bot_id}/evaluate", headers=auth_headers_b)
        assert res.status_code == 404