import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types
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

export interface Chatbot {
  id: string;
  name: string;
  description: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  is_public: string;
  public_token: string | null;
  created_at: string;
  document_count: number;
}

export interface ChatbotDetail extends Chatbot {
  documents: Document[];
}

export interface ChatbotListResponse {
  chatbots: Chatbot[];
  total: number;
}

export interface CreateChatbotData {
  name: string;
  description?: string;
  document_ids?: string[];
  llm_provider?: string;
  llm_model?: string;
  api_key?: string;
}

// Auth helper
async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return {
    "X-User-Id": session.user.id,
  };
}

// Document APIs
export async function uploadDocument(file: File): Promise<Document> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/documents`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Upload failed");
  }

  return res.json();
}

export async function getDocuments(): Promise<DocumentListResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/documents`, { headers });

  if (!res.ok) {
    throw new Error("Failed to fetch documents");
  }

  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/documents/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to delete document");
  }
}

// Chatbot APIs
export async function createChatbot(data: CreateChatbotData): Promise<Chatbot> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/chatbots`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to create chatbot");
  }

  return res.json();
}

export async function getChatbots(): Promise<ChatbotListResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/chatbots`, { headers });

  if (!res.ok) {
    throw new Error("Failed to fetch chatbots");
  }

  return res.json();
}

export async function getChatbot(id: string): Promise<ChatbotDetail> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/chatbots/${id}`, { headers });

  if (!res.ok) {
    throw new Error("Failed to fetch chatbot");
  }

  return res.json();
}

export async function updateChatbot(id: string, data: Partial<CreateChatbotData>): Promise<Chatbot> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/chatbots/${id}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to update chatbot");
  }

  return res.json();
}

export async function deleteChatbot(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/chatbots/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    throw new Error("Failed to delete chatbot");
  }
}