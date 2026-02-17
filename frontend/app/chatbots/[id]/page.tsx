"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  ChevronLeft, Send, Settings, FileText, ExternalLink,
  Bot, User, Loader2, Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft,
} from "lucide-react";
import {
  getChatbot, getSessions, getSessionDetail, deleteSession,
  ChatbotDetail, ChatSession,
} from "@/lib/api";
import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Source {
  text: string;
  score: number;
  filename: string;
  document_id: string;
  page: number | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  loading?: boolean;
}

export default function ChatbotPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params.id as string;

  const [chatbot, setChatbot] = useState<ChatbotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Branding
  const primary = chatbot?.accent_primary || "#715A5A";
  const secondary = chatbot?.accent_secondary || "#2D2B33";
  const avatarUrl = chatbot?.avatar_url ? `${API_URL}/api/chatbots/${chatbotId}/avatar?t=${Date.now()}` : null;

  // Bot avatar component
  const BotAvatar = ({ size = 7 }: { size?: number }) => (
    <div
      className={`w-${size} h-${size} rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden`}
      style={{
        width: `${size * 4}px`,
        height: `${size * 4}px`,
        backgroundColor: avatarUrl ? "transparent" : primary + "30",
        border: avatarUrl ? "none" : `1px solid ${primary}40`,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={chatbot?.name} className="w-full h-full object-cover rounded-lg" />
      ) : (
        <Bot style={{ color: primary, width: `${size * 2}px`, height: `${size * 2}px` }} />
      )}
    </div>
  );

  useEffect(() => {
    async function load() {
      try {
        const [botData, sessData] = await Promise.all([
          getChatbot(chatbotId),
          getSessions(chatbotId),
        ]);
        setChatbot(botData);
        setSessions(sessData.sessions);
      } catch {
        router.push("/chatbots");
      } finally {
        setLoading(false);
        setLoadingSessions(false);
      }
    }
    load();
  }, [chatbotId, router]);

  useEffect(() => {
    if (!activeSessionId) return;
    async function loadMessages() {
      try {
        const detail = await getSessionDetail(chatbotId, activeSessionId!);
        const loaded: Message[] = detail.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources ? JSON.parse(m.sources) : undefined,
        }));
        setMessages(loaded);
      } catch {
        setMessages([]);
      }
    }
    loadMessages();
  }, [activeSessionId, chatbotId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await deleteSession(chatbotId, sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) handleNewChat();
    } catch { /* ignore */ }
  };

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: msg };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    try {
      const authSession = await getSession();
      const res = await fetch(`${API_URL}/api/chat/${chatbotId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": authSession?.user?.id || "",
        },
        body: JSON.stringify({ message: msg, session_id: activeSessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Chat failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          const sourcesMarker = "__SOURCES__";
          const sessionMarker = "__SESSION__";
          const sourcesIdx = fullText.indexOf(sourcesMarker);

          if (sourcesIdx !== -1) {
            const responseText = fullText.substring(0, sourcesIdx).trim();
            const afterSources = fullText.substring(sourcesIdx + sourcesMarker.length);
            const sessionIdx = afterSources.indexOf(sessionMarker);
            let sources: Source[] = [];
            let newSessionId: string | null = null;

            if (sessionIdx !== -1) {
              const sourcesJson = afterSources.substring(0, sessionIdx).trim();
              newSessionId = afterSources.substring(sessionIdx + sessionMarker.length).trim();
              try { sources = JSON.parse(sourcesJson); } catch { /* */ }
            } else {
              try { sources = JSON.parse(afterSources.trim()); } catch { /* */ }
            }

            if (newSessionId && !activeSessionId) {
              setActiveSessionId(newSessionId);
              setSessions((prev) => [{
                id: newSessionId!, chatbot_id: chatbotId,
                title: msg.length > 60 ? msg.substring(0, 60) + "..." : msg,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                message_count: 2,
              }, ...prev]);
            } else if (newSessionId && activeSessionId) {
              setSessions((prev) => prev.map((s) =>
                s.id === activeSessionId
                  ? { ...s, updated_at: new Date().toISOString(), message_count: s.message_count + 2 }
                  : s
              ));
            }

            setMessages((prev) => prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: responseText, sources, loading: false } : m
            ));
          } else {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullText.trim(), loading: false } : m
            ));
          }
        }
      }
    } catch (err) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantMsg.id
          ? { ...m, content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`, loading: false }
          : m
      ));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

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
      <div className="h-full flex">
        {/* Session Sidebar */}
        {sidebarOpen && (
          <div
            className="w-64 flex-shrink-0 flex flex-col h-full"
            style={{ borderRight: `1px solid ${primary}30`, backgroundColor: secondary }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${primary}30` }}>
              <span className="text-xs font-medium" style={{ color: "#D3DAD9", opacity: 0.5 }}>Chat History</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNewChat}
                  className="p-1.5 rounded-md cursor-pointer transition-all hover:brightness-125"
                  style={{ backgroundColor: primary + "20" }}
                  title="New Chat"
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: "#D3DAD9" }} />
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-md cursor-pointer transition-all hover:brightness-125"
                  title="Close sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" style={{ color: "#D3DAD9", opacity: 0.4 }} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {loadingSessions ? (
                <div className="text-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" style={{ color: "#D3DAD9", opacity: 0.3 }} />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: "#D3DAD9", opacity: 0.15 }} />
                  <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.3 }}>No conversations yet</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s.id)}
                    className="flex items-center gap-2 px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-all group"
                    style={{ backgroundColor: activeSessionId === s.id ? primary + "40" : "transparent" }}
                    onMouseEnter={(e) => { if (activeSessionId !== s.id) e.currentTarget.style.backgroundColor = primary + "20"; }}
                    onMouseLeave={(e) => { if (activeSessionId !== s.id) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.3 }} />
                    <span className="text-xs truncate flex-1" style={{ color: "#D3DAD9", opacity: activeSessionId === s.id ? 1 : 0.6 }}>
                      {s.title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#ef444420")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <Trash2 className="w-3 h-3" style={{ color: "#ef4444" }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${primary}20` }}>
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-lg transition-all cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: secondary }}
                  title="Open sidebar"
                >
                  <PanelLeft className="w-4 h-4" style={{ color: "#D3DAD9" }} />
                </button>
              )}
              <button
                onClick={() => router.push("/chatbots")}
                className="p-1.5 rounded-lg transition-all cursor-pointer hover:brightness-110"
                style={{ backgroundColor: secondary }}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: "#D3DAD9" }} />
              </button>
              <div className="flex items-center gap-2.5">
                <BotAvatar size={8} />
                <div>
                  <h1 className="text-sm font-semibold" style={{ color: "#D3DAD9" }}>{chatbot?.name}</h1>
                  <p className="text-[11px]" style={{ color: primary }}>
                    {chatbot?.llm_model || "No LLM configured"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {/* TODO: export */}}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: secondary, color: "#D3DAD9", opacity: 0.6 }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Export
              </button>
              <button
                onClick={() => router.push(`/chatbots/${chatbotId}/settings`)}
                className="p-1.5 rounded-lg cursor-pointer transition-all hover:brightness-110"
                style={{ backgroundColor: secondary }}
              >
                <Settings className="w-4 h-4" style={{ color: "#D3DAD9", opacity: 0.6 }} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Empty State */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20">
                  <BotAvatar size={14} />
                  <h2 className="text-base font-medium mb-1 mt-4" style={{ color: "#D3DAD9" }}>
                    Chat with {chatbot?.name}
                  </h2>
                  <p className="text-xs text-center max-w-sm" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                    Ask questions about your documents. Responses are powered by your LLM with
                    {" "}{chatbot?.document_count} document{chatbot?.document_count !== 1 ? "s" : ""} as context.
                  </p>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="mt-0.5">
                      <BotAvatar size={7} />
                    </div>
                  )}

                  <div className={`max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
                    <div
                      className="px-4 py-3 rounded-xl text-sm leading-relaxed"
                      style={{
                        backgroundColor: msg.role === "user" ? primary : secondary,
                        color: "#D3DAD9",
                        border: msg.role === "assistant" ? `1px solid ${primary}30` : "none",
                      }}
                    >
                      {msg.loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: primary }} />
                          <span style={{ opacity: 0.5 }}>Thinking...</span>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>

                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.sources.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => setExpandedSource(expandedSource === `${msg.id}-${i}` ? null : `${msg.id}-${i}`)}
                            className="w-full text-left cursor-pointer"
                          >
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:brightness-110"
                              style={{ backgroundColor: secondary + "80", border: `1px solid ${primary}20` }}
                            >
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primary, opacity: 0.6 }} />
                              <span className="text-xs truncate" style={{ color: "#D3DAD9", opacity: 0.6 }}>
                                {src.filename}
                                {src.page && <span style={{ opacity: 0.5 }}> · p.{src.page}</span>}
                              </span>
                              <span
                                className="text-[10px] ml-auto flex-shrink-0 px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: primary + "30", color: "#D3DAD9", opacity: 0.5 }}
                              >
                                {Math.round(src.score * 100)}%
                              </span>
                            </div>
                            {expandedSource === `${msg.id}-${i}` && (
                              <div
                                className="mt-1 px-3 py-2.5 rounded-lg text-xs leading-relaxed"
                                style={{ backgroundColor: secondary, color: "#D3DAD9", opacity: 0.6 }}
                              >
                                {src.text}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: primary }}
                    >
                      <User className="w-3.5 h-3.5" style={{ color: "#D3DAD9" }} />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: `1px solid ${primary}20` }}>
            <div className="max-w-3xl mx-auto">
              <div
                className="flex items-end gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: secondary, border: `1px solid ${primary}30` }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your documents..."
                  rows={1}
                  className="flex-1 bg-transparent outline-none resize-none text-sm"
                  style={{ color: "#D3DAD9", maxHeight: "120px" }}
                  onInput={(e) => {
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="p-2 rounded-lg transition-all cursor-pointer hover:brightness-110 flex-shrink-0"
                  style={{
                    backgroundColor: input.trim() && !sending ? primary : "transparent",
                    opacity: input.trim() && !sending ? 1 : 0.3,
                  }}
                >
                  <Send className="w-4 h-4" style={{ color: "#D3DAD9" }} />
                </button>
              </div>
              <p className="text-center mt-2 text-[10px]" style={{ color: "#D3DAD9", opacity: 0.2 }}>
                Responses are generated from your documents using RAG. Always verify important information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}