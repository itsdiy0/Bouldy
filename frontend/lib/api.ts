const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/documents`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Upload failed");
  }

  return res.json();
}

export async function getDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${API_URL}/api/documents`);

  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/documents/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Failed to delete document");
  }
}