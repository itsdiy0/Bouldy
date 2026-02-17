"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProviderIcon from "@/components/ui/ProviderIcon";
import BrandingPicker from "@/components/ui/BrandingPicker";
import { Save, Check, File, Search, Loader2, ChevronLeft, Trash2 } from "lucide-react";
import { getChatbot, updateChatbot, deleteChatbot, uploadAvatar, getDocuments, ChatbotDetail, Document } from "@/lib/api";
import { LLM_PROVIDERS } from "@/lib/llm_providers";

const fileTypeColors: Record<string, string> = { pdf: "#ef4444", docx: "#3b82f6", txt: "#9ca3af" };
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatbotSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chatbotId = params.id as string;
  const fromChat = searchParams.get("from") === "chat";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [accentPrimary, setAccentPrimary] = useState("#715A5A");
  const [accentSecondary, setAccentSecondary] = useState("#2D2B33");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const [activeTab, setActiveTab] = useState<"general" | "documents" | "llm">("general");

  useEffect(() => {
    async function load() {
      try {
        const [chatbot, docsRes] = await Promise.all([
          getChatbot(chatbotId),
          getDocuments(),
        ]);
        setName(chatbot.name);
        setDescription(chatbot.description || "");
        setProvider(chatbot.llm_provider || "");
        setModel(chatbot.llm_model || "");
        setMemoryEnabled(chatbot.memory_enabled === "true");
        setAccentPrimary(chatbot.accent_primary || "#715A5A");
        setAccentSecondary(chatbot.accent_secondary || "#2D2B33");
        if (chatbot.avatar_url) {
          setAvatarPreview(`${API_URL}/api/chatbots/${chatbotId}/avatar?t=${Date.now()}`);
        }
        setAllDocs(docsRes.documents);

        if (chatbot.document_ids && chatbot.document_ids.length > 0) {
          setSelectedDocIds(new Set(chatbot.document_ids));
        }
      } catch {
        setError("Failed to load chatbot");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [chatbotId]);

  const toggleDocument = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateChatbot(chatbotId, {
        name,
        description: description || undefined,
        document_ids: Array.from(selectedDocIds),
        llm_provider: provider || undefined,
        llm_model: model || undefined,
        api_key: apiKey || undefined,
        memory_enabled: memoryEnabled ? "true" : "false",
        accent_primary: accentPrimary,
        accent_secondary: accentSecondary,
      });

      // Upload avatar if changed
      if (avatarFile) {
        try {
          await uploadAvatar(chatbotId, avatarFile);
          setAvatarFile(null);
        } catch {
          setError("Saved settings but avatar upload failed");
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteChatbot(chatbotId);
      router.push("/chatbots");
    } catch {
      setError("Failed to delete chatbot");
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const selectedProvider = LLM_PROVIDERS.find((p) => p.id === provider);
  const filteredDocs = allDocs.filter((d) =>
    d.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { id: "general" as const, label: "General" },
    { id: "documents" as const, label: "Documents" },
    { id: "llm" as const, label: "LLM Config" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#D3DAD9", opacity: 0.5 }} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex items-start justify-center p-8 pt-12">
        <div className="w-full max-w-4xl">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(fromChat ? `/chatbots/${chatbotId}` : "/chatbots")}
                className="flex items-center gap-1 text-sm transition-all rounded-lg px-2 py-1.5 cursor-pointer hover:opacity-100"
                style={{ color: "#D3DAD9", opacity: 0.5 }}
              >
                <ChevronLeft className="w-4 h-4" />
                {fromChat ? "Back to Chat" : "Chatbots"}
              </button>
              <span style={{ color: "#715A5A" }}>/</span>
              <h1 className="text-lg font-bold" style={{ color: "#D3DAD9" }}>{name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer hover:brightness-110"
                style={{ backgroundColor: "#ef4444", color: "#ffffff" }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer hover:brightness-110"
                style={{
                  backgroundColor: saved ? "#10a37f" : "#715A5A",
                  color: "#D3DAD9",
                  opacity: saving || !name.trim() ? 0.5 : 1,
                }}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg mb-5 text-sm" style={{ backgroundColor: "#ef444420", color: "#ef4444" }}>
              {error}
            </div>
          )}

          {/* Main container */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A40" }}
          >
            {/* Tabs */}
            <div className="flex" style={{ borderBottom: "1px solid #715A5A30" }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-3.5 text-sm font-medium transition-all relative cursor-pointer hover:opacity-80"
                  style={{ color: "#D3DAD9", opacity: activeTab === tab.id ? 1 : 0.4 }}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 rounded-full"
                      style={{ backgroundColor: "#715A5A" }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {/* General Tab */}
              {activeTab === "general" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg outline-none text-sm"
                      style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg outline-none resize-none text-sm"
                      style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                    />
                  </div>
                  <BrandingPicker
                    primary={accentPrimary}
                    secondary={accentSecondary}
                    avatarPreview={avatarPreview}
                    onColorChange={(p, s) => { setAccentPrimary(p); setAccentSecondary(s); }}
                    onAvatarChange={(file, preview) => { setAvatarFile(file); setAvatarPreview(preview); }}
                  />
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === "documents" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 max-w-[260px]"
                      style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}
                    >
                      <Search className="w-4 h-4" style={{ color: "#D3DAD9", opacity: 0.5 }} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents..."
                        className="bg-transparent outline-none text-sm flex-1"
                        style={{ color: "#D3DAD9" }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.5 }}>
                      {selectedDocIds.size} of {allDocs.length} selected
                    </span>
                  </div>
                  {allDocs.length === 0 ? (
                    <div className="text-center py-12">
                      <File className="w-12 h-12 mx-auto mb-3" style={{ color: "#D3DAD9", opacity: 0.2 }} />
                      <p className="text-sm mb-4" style={{ color: "#D3DAD9", opacity: 0.5 }}>No documents uploaded yet</p>
                      <button
                        onClick={() => router.push("/documents")}
                        className="px-4 py-2 rounded-lg text-sm cursor-pointer"
                        style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
                      >
                        Upload Documents
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3 max-h-[320px] overflow-auto">
                      {filteredDocs.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => toggleDocument(doc.id)}
                          className="relative flex flex-col items-center p-3 rounded-lg cursor-pointer transition-all"
                          style={{ backgroundColor: selectedDocIds.has(doc.id) ? "#715A5A" : "#37353E" }}
                        >
                          <div
                            className="absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                            style={{
                              borderColor: "#D3DAD9",
                              backgroundColor: selectedDocIds.has(doc.id) ? "#D3DAD9" : "transparent",
                              opacity: selectedDocIds.has(doc.id) ? 1 : 0.4,
                            }}
                          >
                            {selectedDocIds.has(doc.id) && <Check className="w-2.5 h-2.5" style={{ color: "#37353E" }} />}
                          </div>
                          <File className="w-8 h-8 mb-2" style={{ color: fileTypeColors[doc.file_type] || "#9ca3af" }} />
                          <p className="text-[10px] text-center truncate w-full" style={{ color: "#D3DAD9" }} title={doc.original_filename}>
                            {doc.original_filename}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LLM Config Tab */}
              {activeTab === "llm" && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm mb-3" style={{ color: "#D3DAD9", opacity: 0.7 }}>Provider</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {LLM_PROVIDERS.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setProvider(p.id); setModel(""); }}
                          className="px-4 py-3 rounded-lg text-left transition-all flex items-center gap-3 cursor-pointer hover:brightness-110"
                          style={{
                            backgroundColor: provider === p.id ? p.bg : "#37353E",
                            border: provider === p.id ? `2px solid ${p.color}` : "2px solid transparent",
                          }}
                        >
                          <ProviderIcon provider={p.id} size={20} color={p.color} />
                          <span className="text-sm font-medium" style={{ color: "#D3DAD9" }}>{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {provider && (
                    <div>
                      <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Model</label>
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg outline-none text-sm"
                        style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                      >
                        <option value="">Select model</option>
                        {selectedProvider?.models.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {provider && provider !== "ollama" && (
                    <div>
                      <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>
                        API Key
                        <span className="ml-2 text-xs" style={{ opacity: 0.5 }}>(leave blank to keep current)</span>
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-4 py-3 rounded-lg outline-none text-sm"
                        style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                      />
                    </div>
                  )}

                  {/* Memory Toggle */}
                  <div
                    className="flex items-center justify-between px-4 py-4 rounded-lg"
                    style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#D3DAD9" }}>Conversation Memory</p>
                      <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                        Include previous messages as context for follow-up questions
                      </p>
                      {memoryEnabled && (
                        <p className="text-[11px] mt-1.5" style={{ color: "#d4a574", opacity: 0.7 }}>
                          ⚠ Sends last 10 messages with each request — increases token usage
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setMemoryEnabled(!memoryEnabled)}
                      className="w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0 relative"
                      style={{ backgroundColor: memoryEnabled ? "#715A5A" : "#2D2B33" }}
                    >
                      <div
                        className="rounded-full absolute top-[3px] transition-all"
                        style={{
                          width: "18px",
                          height: "18px",
                          backgroundColor: memoryEnabled ? "#D3DAD9" : "#715A5A",
                          left: memoryEnabled ? "22px" : "3px",
                        }}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "#00000080" }}>
          <div className="rounded-xl p-6 max-w-sm w-full mx-4" style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A" }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#D3DAD9" }}>Delete Chatbot</h3>
            <p className="text-sm mb-6" style={{ color: "#D3DAD9", opacity: 0.6 }}>
              Are you sure? This will permanently delete <strong>{name}</strong>, all its chat sessions, and its vector index. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: "transparent", color: "#D3DAD9", border: "1px solid #715A5A" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: "#ef4444", color: "#ffffff", opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}