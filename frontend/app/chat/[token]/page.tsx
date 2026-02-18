"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Send, Bot, User, Loader2, FileText } from "lucide-react";

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

interface ChatbotInfo {
  name: string;
  description: string | null;
  accent_primary: string;
  accent_secondary: string;
  avatar_url: string | null;
  has_avatar: boolean;
}

export default function PublicChatPage() {
  const params = useParams();
  const token = params.token as string;

  const [chatbot, setChatbot] = useState<ChatbotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const primary = chatbot?.accent_primary || "#715A5A";
  const secondary = chatbot?.accent_secondary || "#2D2B33";
  const avatarUrl = chatbot?.has_avatar ? `${API_URL}${chatbot.avatar_url}` : null;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/public/${token}`);
        if (!res.ok) throw new Error("Chatbot not found");
        const data = await res.json();
        setChatbot(data);
      } catch {
        setError("This chatbot is not available.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const BotAvatar = ({ size = 7 }: { size?: number }) => (
    <div
      className="rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
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

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || sending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: msg };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", loading: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/public/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      if (!res.ok) throw new Error("Chat failed");

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
          const sourcesIdx = fullText.indexOf(sourcesMarker);

          if (sourcesIdx !== -1) {
            const responseText = fullText.substring(0, sourcesIdx).trim();
            const sourcesJson = fullText.substring(sourcesIdx + sourcesMarker.length).trim();
            let sources: Source[] = [];
            try { sources = JSON.parse(sourcesJson); } catch { /* */ }

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
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantMsg.id ? { ...m, content: "Sorry, something went wrong. Please try again.", loading: false } : m
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
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#1a1a1a" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#D3DAD9", opacity: 0.5 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#1a1a1a" }}>
        <Bot className="w-12 h-12 mb-4" style={{ color: "#D3DAD9", opacity: 0.2 }} />
        <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.5 }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: "#1a1a1a" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
        style={{ backgroundColor: secondary, borderBottom: `1px solid ${primary}20` }}
      >
        <BotAvatar size={8} />
        <div>
          <h1 className="text-sm font-semibold" style={{ color: "#D3DAD9" }}>{chatbot?.name}</h1>
          {chatbot?.description && (
            <p className="text-[11px]" style={{ color: "#D3DAD9", opacity: 0.4 }}>{chatbot.description}</p>
          )}
        </div>
        <div className="ml-auto">
          <span className="text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: primary + "20", color: primary }}>
            Powered by Bouldy
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <BotAvatar size={14} />
              <h2 className="text-base font-medium mb-1 mt-4" style={{ color: "#D3DAD9" }}>
                {chatbot?.name}
              </h2>
              <p className="text-xs text-center max-w-sm" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                {chatbot?.description || "Ask me anything about the documents I've been trained on."}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="mt-0.5"><BotAvatar size={7} /></div>
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
                  ) : msg.content}
                </div>

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

      {/* Input */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: `1px solid ${primary}20` }}>
        <div className="max-w-2xl mx-auto">
          <div
            className="flex items-end gap-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: secondary, border: `1px solid ${primary}30` }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
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
          <p className="text-center mt-2 text-[10px]" style={{ color: "#D3DAD9", opacity: 0.15 }}>
            Powered by Bouldy
          </p>
        </div>
      </div>
    </div>
  );
}