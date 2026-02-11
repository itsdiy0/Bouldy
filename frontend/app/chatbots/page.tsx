"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProviderIcon from "@/components/ui/ProviderIcon";
import { Plus, Bot, Trash2, Settings, FileText, ChevronRight } from "lucide-react";
import { getChatbots, deleteChatbot, Chatbot } from "@/lib/api";

const providerMeta: Record<string, { name: string; color: string }> = {
  openai: { name: "OpenAI", color: "#10a37f" },
  anthropic: { name: "Anthropic", color: "#d4a574" },
  gemini: { name: "Google Gemini", color: "#8E75B2" },
  ollama: { name: "Ollama", color: "#ffffff" },
  grok: { name: "Grok (xAI)", color: "#ffffff" },
};

export default function ChatbotsPage() {
  const router = useRouter();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchChatbots();
  }, []);

  async function fetchChatbots() {
    try {
      const data = await getChatbots();
      setChatbots(data.chatbots);
    } catch {
      setError("Failed to load chatbots");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteChatbot(deleteId);
      setChatbots((prev) => prev.filter((c) => c.id !== deleteId));
      setDeleteId(null);
    } catch {
      setError("Failed to delete chatbot");
    } finally {
      setDeleting(false);
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <DashboardLayout>
      <div className="h-full flex items-start justify-center p-8 pt-16">
        <div className="w-full max-w-4xl">
          {/* Container */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A40" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: "1px solid #715A5A30" }}
            >
              <div>
                <h1 className="text-xl font-bold" style={{ color: "#D3DAD9" }}>My Chatbots</h1>
                <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                  {chatbots.length} chatbot{chatbots.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => router.push("/chatbots/create")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
              >
                <Plus className="w-4 h-4" />
                New Chatbot
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="px-6 pt-4">
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "#ef444420", color: "#ef4444" }}>
                  {error}
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="text-center py-16">
                <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.5 }}>Loading...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && chatbots.length === 0 && (
              <div className="text-center py-16">
                <Bot className="w-12 h-12 mx-auto mb-3" style={{ color: "#D3DAD9", opacity: 0.2 }} />
                <h2 className="text-sm font-medium mb-1" style={{ color: "#D3DAD9" }}>No chatbots yet</h2>
                <p className="text-xs mb-5" style={{ color: "#D3DAD9", opacity: 0.5 }}>
                  Create your first chatbot to get started
                </p>
                <button
                  onClick={() => router.push("/chatbots/create")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
                >
                  <Plus className="w-4 h-4" />
                  Create Chatbot
                </button>
              </div>
            )}

            {/* Chatbot List */}
            {!loading && chatbots.length > 0 && (
              <div>
                {chatbots.map((bot, idx) => {
                  const meta = bot.llm_provider ? providerMeta[bot.llm_provider] : null;
                  return (
                    <div
                      key={bot.id}
                      className="flex items-center gap-4 px-6 py-4 cursor-pointer transition-all group"
                      style={{
                        borderBottom: idx < chatbots.length - 1 ? "1px solid #715A5A20" : "none",
                      }}
                      onClick={() => router.push(`/chatbots/${bot.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#37353E")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {/* Provider Icon */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "#37353E" }}
                      >
                        {meta ? (
                          <ProviderIcon provider={bot.llm_provider!} size={20} color={meta.color} />
                        ) : (
                          <Bot className="w-5 h-5" style={{ color: "#D3DAD9", opacity: 0.5 }} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate" style={{ color: "#D3DAD9" }}>
                          {bot.name}
                        </h3>
                        <p className="text-xs truncate mt-0.5" style={{ color: meta?.color || "#D3DAD980" }}>
                          {meta ? `${meta.name} · ${bot.llm_model || "No model"}` : "No provider configured"}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" style={{ color: "#D3DAD9", opacity: 0.3 }} />
                          <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                            {bot.document_count}
                          </span>
                        </div>
                        <span className="text-xs hidden sm:block" style={{ color: "#D3DAD9", opacity: 0.3 }}>
                          {formatDate(bot.created_at)}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/chatbots/${bot.id}/settings`);
                          }}
                          className="p-1.5 rounded-md transition-all"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#715A5A40")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <Settings className="w-3.5 h-3.5" style={{ color: "#D3DAD9", opacity: 0.6 }} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(bot.id);
                          }}
                          className="p-1.5 rounded-md transition-all"
                          style={{ backgroundColor: "transparent" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ef444420")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444", opacity: 0.6 }} />
                        </button>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.2 }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "#00000080" }}>
          <div className="rounded-xl p-6 max-w-sm w-full mx-4" style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A" }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#D3DAD9" }}>Delete Chatbot</h3>
            <p className="text-sm mb-6" style={{ color: "#D3DAD9", opacity: 0.6 }}>
              Are you sure? This will permanently delete this chatbot and all its configuration. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "transparent", color: "#D3DAD9", border: "1px solid #715A5A" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium"
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