"""
Unit tests for document management.
Covers: upload, list, delete, validation, and tenant isolation.
S3/MinIO calls are mocked throughout.
"""

import uuid
from unittest.mock import patch



# ──────────────────────────────────────────────
#  Upload
# ──────────────────────────────────────────────

class TestDocumentUpload:
    """Tests for POST /api/documents."""

    @patch("app.routers.documents.upload_file")
    def test_upload_pdf(self, mock_upload, client, auth_headers):
        """Uploading a valid PDF creates a document record."""
        mock_upload.return_value = "fake-key"
        res = client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("report.pdf", b"%PDF-1.4 fake content", "application/pdf")},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["original_filename"] == "report.pdf"
        assert data["file_type"] == "pdf"
        assert data["status"] == "uploaded"
        assert data["file_size"] == len(b"%PDF-1.4 fake content")
        mock_upload.assert_called_once()

    @patch("app.routers.documents.upload_file")
    def test_upload_docx(self, mock_upload, client, auth_headers):
        """Uploading a valid DOCX succeeds."""
        mock_upload.return_value = "fake-key"
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        res = client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("doc.docx", b"fake docx bytes", content_type)},
        )
        assert res.status_code == 200
        assert res.json()["file_type"] == "docx"

    @patch("app.routers.documents.upload_file")
    def test_upload_txt(self, mock_upload, client, auth_headers):
        """Uploading a valid TXT file succeeds."""
        mock_upload.return_value = "fake-key"
        res = client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("notes.txt", b"Hello world", "text/plain")},
        )
        assert res.status_code == 200
        assert res.json()["file_type"] == "txt"

    def test_upload_unsupported_type(self, client, auth_headers):
        """Uploading a disallowed file type returns 400."""
        res = client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("image.png", b"fake png", "image/png")},
        )
        assert res.status_code == 400

    @patch("app.routers.documents.upload_file")
    def test_upload_too_large(self, mock_upload, client, auth_headers):
        """Uploading a file over 50MB returns 400."""
        large_content = b"x" * (50 * 1024 * 1024 + 1)
        res = client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("huge.pdf", large_content, "application/pdf")},
        )
        assert res.status_code == 400
        mock_upload.assert_not_called()

    def test_upload_no_file(self, client, auth_headers):
        """Upload request without a file returns 422."""
        res = client.post("/api/documents", headers=auth_headers)
        assert res.status_code == 422

    def test_upload_unauthenticated(self, client):
        """Upload without auth header returns 422."""
        res = client.post(
            "/api/documents",
            files={"file": ("report.pdf", b"fake", "application/pdf")},
        )
        assert res.status_code == 422


# ──────────────────────────────────────────────
#  List
# ──────────────────────────────────────────────

class TestDocumentList:
    """Tests for GET /api/documents."""

    def test_list_empty(self, client, auth_headers):
        """User with no documents gets an empty list."""
        res = client.get("/api/documents", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["documents"] == []
        assert data["total"] == 0

    @patch("app.routers.documents.upload_file")
    def test_list_with_documents(self, mock_upload, client, auth_headers):
        """User sees their uploaded documents."""
        mock_upload.return_value = "fake-key"
        # Upload two documents
        for name in ("a.pdf", "b.pdf"):
            client.post(
                "/api/documents",
                headers=auth_headers,
                files={"file": (name, b"content", "application/pdf")},
            )
        res = client.get("/api/documents", headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 2
        assert len(data["documents"]) == 2

    def test_list_unauthenticated(self, client):
        """List without auth header returns 422."""
        res = client.get("/api/documents")
        assert res.status_code == 422


# ──────────────────────────────────────────────
#  Delete
# ──────────────────────────────────────────────

class TestDocumentDelete:
    """Tests for DELETE /api/documents/{document_id}."""

    @patch("app.routers.documents.delete_file")
    @patch("app.routers.documents.upload_file")
    def test_delete_own_document(self, mock_upload, mock_delete, client, auth_headers):
        """User can delete their own document."""
        mock_upload.return_value = "fake-key"
        # Upload first
        upload_res = client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("delete_me.pdf", b"content", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        # Delete
        res = client.delete(f"/api/documents/{doc_id}", headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["message"] == "Document deleted"
        mock_delete.assert_called_once()

        # Verify it's gone
        list_res = client.get("/api/documents", headers=auth_headers)
        assert list_res.json()["total"] == 0

    def test_delete_nonexistent(self, client, auth_headers):
        """Deleting a non-existent document returns 404."""
        fake_id = str(uuid.uuid4())
        res = client.delete(f"/api/documents/{fake_id}", headers=auth_headers)
        assert res.status_code == 404

    def test_delete_invalid_id(self, client, auth_headers):
        """Deleting with invalid UUID returns 422."""
        res = client.delete("/api/documents/not-a-uuid", headers=auth_headers)
        assert res.status_code == 422

    def test_delete_unauthenticated(self, client):
        """Delete without auth returns 422."""
        fake_id = str(uuid.uuid4())
        res = client.delete(f"/api/documents/{fake_id}")
        assert res.status_code == 422


# ──────────────────────────────────────────────
#  Tenant Isolation
# ──────────────────────────────────────────────

class TestDocumentTenantIsolation:
    """Tests ensuring users cannot access each other's documents."""

    @patch("app.routers.documents.upload_file")
    def test_cannot_list_other_users_documents(
        self, mock_upload, client, auth_headers, auth_headers_b
    ):
        """User B cannot see User A's documents."""
        mock_upload.return_value = "fake-key"
        # User A uploads
        client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("secret.pdf", b"content", "application/pdf")},
        )
        # User B lists — should be empty
        res = client.get("/api/documents", headers=auth_headers_b)
        assert res.status_code == 200
        assert res.json()["total"] == 0

    @patch("app.routers.documents.upload_file")
    def test_cannot_delete_other_users_document(
        self, mock_upload, client, auth_headers, auth_headers_b
    ):
        """User B cannot delete User A's document."""
        mock_upload.return_value = "fake-key"
        # User A uploads
        upload_res = client.post(
            "/api/documents",
            headers=auth_headers,
            files={"file": ("private.pdf", b"content", "application/pdf")},
        )
        doc_id = upload_res.json()["id"]

        # User B tries to delete — should 404
        res = client.delete(f"/api/documents/{doc_id}", headers=auth_headers_b)
        assert res.status_code == 404

        # Verify still exists for User A
        list_res = client.get("/api/documents", headers=auth_headers)
        assert list_res.json()["total"] == 1