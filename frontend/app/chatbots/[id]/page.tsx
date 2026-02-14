"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProviderIcon from "@/components/ui/ProviderIcon";
import { ChevronLeft, Send, Settings, FileText, ExternalLink, Bot, User, Loader2 } from "lucide-react";
import { getChatbot, ChatbotDetail } from "@/lib/api";
import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const providerMeta: Record<string, { name: string; color: string }> = {
  openai: { name: "OpenAI", color: "#10a37f" },
  anthropic: { name: "Anthropic", color: "#d4a574" },
  gemini: { name: "Google Gemini", color: "#8E75B2" },
  ollama: { name: "Ollama", color: "#ffffff" },
  grok: { name: "Grok (xAI)", color: "#ffffff" },
};

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getChatbot(chatbotId);
        setChatbot(data);
      } catch {
        router.push("/chatbots");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [chatbotId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: msg };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    try {
      const session = await getSession();
      const res = await fetch(`${API_URL}/api/chat/${chatbotId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": session?.user?.id || "",
        },
        body: JSON.stringify({ message: msg }),
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

          // Check if sources have arrived
          const sourcesMarker = "__SOURCES__";
          const sourcesIdx = fullText.indexOf(sourcesMarker);

          if (sourcesIdx !== -1) {
            const responseText = fullText.substring(0, sourcesIdx).trim();
            const sourcesJson = fullText.substring(sourcesIdx + sourcesMarker.length);
            try {
              const sources = JSON.parse(sourcesJson);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: responseText, sources, loading: false } : m
                )
              );
            } catch {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: responseText, loading: false } : m
                )
              );
            }
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: fullText.trim(), loading: false } : m
              )
            );
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`, loading: false }
            : m
        )
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const meta = chatbot?.llm_provider ? providerMeta[chatbot.llm_provider] : null;

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
      <div className="h-full flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid #715A5A30" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/chatbots")}
              className="p-1.5 rounded-lg transition-all cursor-pointer hover:brightness-110"
              style={{ backgroundColor: "#2D2B33" }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: "#D3DAD9" }} />
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "#2D2B33" }}
              >
                {meta ? (
                  <ProviderIcon provider={chatbot!.llm_provider!} size={16} color={meta.color} />
                ) : (
                  <Bot className="w-4 h-4" style={{ color: "#D3DAD9", opacity: 0.5 }} />
                )}
              </div>
              <div>
                <h1 className="text-sm font-semibold" style={{ color: "#D3DAD9" }}>{chatbot?.name}</h1>
                <p className="text-[11px]" style={{ color: meta?.color || "#D3DAD980" }}>
                  {meta ? `${meta.name} · ${chatbot?.llm_model}` : "No LLM configured"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {/* TODO: export/embed */}}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:brightness-110"
              style={{ backgroundColor: "#2D2B33", color: "#D3DAD9", opacity: 0.6 }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => router.push(`/chatbots/${chatbotId}/settings`)}
              className="p-1.5 rounded-lg cursor-pointer transition-all hover:brightness-110"
              style={{ backgroundColor: "#2D2B33" }}
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
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A40" }}
                >
                  {meta ? (
                    <ProviderIcon provider={chatbot!.llm_provider!} size={24} color={meta.color} />
                  ) : (
                    <Bot className="w-6 h-6" style={{ color: "#D3DAD9", opacity: 0.3 }} />
                  )}
                </div>
                <h2 className="text-base font-medium mb-1" style={{ color: "#D3DAD9" }}>
                  Chat with {chatbot?.name}
                </h2>
                <p className="text-xs text-center max-w-sm" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                  Ask questions about your documents. Responses are powered by {meta?.name || "your LLM"} with 
                  {" "}{chatbot?.document_count} document{chatbot?.document_count !== 1 ? "s" : ""} as context.
                </p>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: "#2D2B33" }}
                  >
                    {meta ? (
                      <ProviderIcon provider={chatbot!.llm_provider!} size={14} color={meta.color} />
                    ) : (
                      <Bot className="w-3.5 h-3.5" style={{ color: "#D3DAD9", opacity: 0.5 }} />
                    )}
                  </div>
                )}

                <div className={`max-w-[75%] ${msg.role === "user" ? "order-first" : ""}`}>
                  <div
                    className="px-4 py-3 rounded-xl text-sm leading-relaxed"
                    style={{
                      backgroundColor: msg.role === "user" ? "#715A5A" : "#2D2B33",
                      color: "#D3DAD9",
                      border: msg.role === "assistant" ? "1px solid #715A5A30" : "none",
                    }}
                  >
                    {msg.loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#D3DAD9", opacity: 0.5 }} />
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
                            style={{ backgroundColor: "#2D2B3380", border: "1px solid #715A5A20" }}
                          >
                            <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D3DAD9", opacity: 0.4 }} />
                            <span className="text-xs truncate" style={{ color: "#D3DAD9", opacity: 0.6 }}>
                              {src.filename}
                              {src.page && <span style={{ opacity: 0.5 }}> · p.{src.page}</span>}
                            </span>
                            <span
                              className="text-[10px] ml-auto flex-shrink-0 px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "#715A5A40", color: "#D3DAD9", opacity: 0.4 }}
                            >
                              {Math.round(src.score * 100)}%
                            </span>
                          </div>
                          {expandedSource === `${msg.id}-${i}` && (
                            <div
                              className="mt-1 px-3 py-2.5 rounded-lg text-xs leading-relaxed"
                              style={{ backgroundColor: "#37353E", color: "#D3DAD9", opacity: 0.6 }}
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
                    style={{ backgroundColor: "#715A5A" }}
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
        <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: "1px solid #715A5A30" }}>
          <div className="max-w-3xl mx-auto">
            <div
              className="flex items-end gap-3 rounded-xl px-4 py-3"
              style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A40" }}
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
                  backgroundColor: input.trim() && !sending ? "#715A5A" : "transparent",
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
    </DashboardLayout>
  );
}