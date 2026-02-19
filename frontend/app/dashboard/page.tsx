"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProviderIcon from "@/components/ui/ProviderIcon";
import {
  Bot, FileText, MessageSquare, HardDrive, Plus, ArrowRight,
  Globe, Upload, Loader2, MessagesSquare,
} from "lucide-react";
import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const providerMeta: Record<string, { name: string; color: string }> = {
  openai: { name: "OpenAI", color: "#10a37f" },
  anthropic: { name: "Anthropic", color: "#d4a574" },
  gemini: { name: "Google Gemini", color: "#8E75B2" },
  ollama: { name: "Ollama", color: "#ffffff" },
  grok: { name: "Grok (xAI)", color: "#ffffff" },
};

interface DashboardData {
  total_chatbots: number;
  total_documents: number;
  total_sessions: number;
  total_messages: number;
  published_chatbots: number;
  storage_bytes: number;
  recent_activity: {
    message: string;
    chatbot_name: string;
    chatbot_id: string | null;
    created_at: string;
  }[];
  chatbot_overview: {
    id: string;
    name: string;
    llm_provider: string | null;
    document_count: number;
    session_count: number;
    is_public: string;
    accent_primary: string;
  }[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const session = await getSession();
        const res = await fetch(`${API_URL}/api/dashboard`, {
          headers: { "X-User-Id": session?.user?.id || "" },
        });
        if (res.ok) setData(await res.json());
      } catch { /* */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#D3DAD9", opacity: 0.5 }} />
        </div>
      </DashboardLayout>
    );
  }

  const d = data!;
  const hasData = d.total_chatbots > 0;

  return (
    <DashboardLayout>
      <div className="h-full overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#D3DAD9" }}>Dashboard</h1>
              <p className="text-sm mt-1" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                Overview of your Bouldy workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/documents")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: "#2D2B33", color: "#D3DAD9", border: "1px solid #715A5A40" }}
              >
                <Upload className="w-4 h-4" />
                Upload Docs
              </button>
              <button
                onClick={() => router.push("/chatbots/create")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}
              >
                <Plus className="w-4 h-4" />
                New Chatbot
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Chatbots", value: d.total_chatbots, icon: Bot, color: "#715A5A" },
              { label: "Documents", value: d.total_documents, icon: FileText, color: "#3b82f6" },
              { label: "Conversations", value: d.total_sessions, icon: MessageSquare, color: "#10a37f" },
              { label: "Messages", value: d.total_messages, icon: MessagesSquare, color: "#d4a574" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-5"
                style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A30" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: stat.color + "20" }}
                  >
                    <stat.icon className="w-4.5 h-4.5" style={{ color: stat.color, width: "18px", height: "18px" }} />
                  </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: "#D3DAD9" }}>{stat.value}</p>
                <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Sub stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div
              className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A30" }}
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4" style={{ color: "#22c55e" }} />
                <span className="text-sm" style={{ color: "#D3DAD9" }}>Published Chatbots</span>
              </div>
              <span className="text-sm font-bold" style={{ color: "#D3DAD9" }}>{d.published_chatbots}</span>
            </div>
            <div
              className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A30" }}
            >
              <div className="flex items-center gap-3">
                <HardDrive className="w-4 h-4" style={{ color: "#8E75B2" }} />
                <span className="text-sm" style={{ color: "#D3DAD9" }}>Storage Used</span>
              </div>
              <span className="text-sm font-bold" style={{ color: "#D3DAD9" }}>{formatBytes(d.storage_bytes)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Chatbot Overview — wider */}
            <div
              className="lg:col-span-3 rounded-xl overflow-hidden"
              style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A30" }}
            >
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #715A5A20" }}>
                <span className="text-sm font-medium" style={{ color: "#D3DAD9" }}>Your Chatbots</span>
                <button
                  onClick={() => router.push("/chatbots")}
                  className="flex items-center gap-1 text-xs cursor-pointer"
                  style={{ color: "#D3DAD9", opacity: 0.4 }}
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {d.chatbot_overview.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-10 h-10 mx-auto mb-3" style={{ color: "#D3DAD9", opacity: 0.15 }} />
                  <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.3 }}>No chatbots yet</p>
                  <button
                    onClick={() => router.push("/chatbots/create")}
                    className="mt-3 text-xs cursor-pointer"
                    style={{ color: "#715A5A" }}
                  >
                    Create your first chatbot
                  </button>
                </div>
              ) : (
                <div>
                  {d.chatbot_overview.map((bot, idx) => {
                    const meta = bot.llm_provider ? providerMeta[bot.llm_provider] : null;
                    return (
                      <div
                        key={bot.id}
                        onClick={() => router.push(`/chatbots/${bot.id}`)}
                        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all"
                        style={{ borderBottom: idx < d.chatbot_overview.length - 1 ? "1px solid #715A5A15" : "none" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#37353E")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: bot.accent_primary + "20" }}
                        >
                          {meta ? (
                            <ProviderIcon provider={bot.llm_provider!} size={16} color={meta.color} />
                          ) : (
                            <Bot className="w-4 h-4" style={{ color: "#D3DAD9", opacity: 0.3 }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#D3DAD9" }}>{bot.name}</p>
                          <p className="text-[11px]" style={{ color: meta?.color || "#D3DAD980" }}>
                            {meta?.name || "No provider"}{bot.document_count > 0 ? ` · ${bot.document_count} docs` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {bot.is_public === "true" && (
                            <Globe className="w-3.5 h-3.5" style={{ color: "#22c55e", opacity: 0.7 }} />
                          )}
                          <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.3 }}>
                            {bot.session_count} chat{bot.session_count !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity — narrower */}
            <div
              className="lg:col-span-2 rounded-xl overflow-hidden"
              style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A30" }}
            >
              <div className="px-5 py-4" style={{ borderBottom: "1px solid #715A5A20" }}>
                <span className="text-sm font-medium" style={{ color: "#D3DAD9" }}>Recent Activity</span>
              </div>
              {d.recent_activity.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3" style={{ color: "#D3DAD9", opacity: 0.15 }} />
                  <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.3 }}>No conversations yet</p>
                </div>
              ) : (
                <div>
                  {d.recent_activity.map((activity, idx) => (
                    <div
                      key={idx}
                      onClick={() => activity.chatbot_id && router.push(`/chatbots/${activity.chatbot_id}`)}
                      className="px-5 py-3 cursor-pointer transition-all"
                      style={{ borderBottom: idx < d.recent_activity.length - 1 ? "1px solid #715A5A15" : "none" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#37353E")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <p className="text-xs truncate" style={{ color: "#D3DAD9", opacity: 0.8 }}>
                        {activity.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: "#715A5A" }}>{activity.chatbot_name}</span>
                        <span className="text-[10px]" style={{ color: "#D3DAD9", opacity: 0.2 }}>·</span>
                        <span className="text-[10px]" style={{ color: "#D3DAD9", opacity: 0.2 }}>
                          {timeAgo(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}