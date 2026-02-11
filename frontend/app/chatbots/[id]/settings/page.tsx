"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProviderIcon from "@/components/ui/ProviderIcon";
import { Save, Check, File, Search, Loader2, ChevronLeft } from "lucide-react";
import { getChatbot, updateChatbot, getDocuments, ChatbotDetail, Document } from "@/lib/api";

const LLM_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"], color: "#10a37f", bg: "#10a37f20" },
  { id: "anthropic", name: "Anthropic", models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"], color: "#d4a574", bg: "#d4a57420" },
  { id: "gemini", name: "Google Gemini", models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"], color: "#8E75B2", bg: "#8E75B220" },
  { id: "ollama", name: "Ollama", models: ["llama3", "llama2", "mistral", "codellama"], color: "#ffffff", bg: "#ffffff15" },
  { id: "grok", name: "Grok (xAI)", models: ["grok-2", "grok-2-mini", "grok-beta"], color: "#000000", bg: "#ffffff15" },
];

const fileTypeColors: Record<string, string> = { pdf: "#ef4444", docx: "#3b82f6", txt: "#9ca3af" };

export default function ChatbotSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

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
        setAllDocs(docsRes.documents);

        // Pre-select documents that belong to this chatbot
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
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
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
                onClick={() => router.push("/chatbots")}
                className="flex items-center gap-1 text-sm transition-all rounded-lg px-2 py-1.5 cursor-pointer hover:opacity-100"
                style={{ color: "#D3DAD9", opacity: 0.5 }}
              >
                <ChevronLeft className="w-4 h-4" />
                Chatbots
              </button>
              <span style={{ color: "#715A5A" }}>/</span>
              <h1 className="text-lg font-bold" style={{ color: "#D3DAD9" }}>{name}</h1>
            </div>
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
                        className="px-4 py-2 rounded-lg text-sm"
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}