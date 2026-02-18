import { useState } from "react";
import { X, Copy, Check, Globe, Code, ExternalLink, Eye } from "lucide-react";
import { togglePublish } from "@/lib/api";

interface ExportPanelProps {
  chatbotId: string;
  chatbotName: string;
  isPublic: string;
  publicToken: string;
  accentPrimary: string;
  accentSecondary: string;
  onClose: () => void;
  onPublishChange: (isPublic: string) => void;
}

export default function ExportPanel({
  chatbotId,
  chatbotName,
  isPublic,
  publicToken,
  accentPrimary,
  accentSecondary,
  onClose,
  onPublishChange,
}: ExportPanelProps) {
  const [toggling, setToggling] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [activeTab, setActiveTab] = useState<"link" | "embed">("link");

  const published = isPublic === "true";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${baseUrl}/chat/${publicToken}`;
  const embedCode = `<iframe
  src="${publicUrl}?embed=true"
  width="400"
  height="600"
  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.2);"
  allow="clipboard-write"
></iframe>`;

  const widgetCode = `<script
  src="${baseUrl}/widget.js"
  data-chatbot-token="${publicToken}"
  data-primary="${accentPrimary}"
  data-secondary="${accentSecondary}"
  data-position="bottom-right"
  async
></script>`;

  const handleToggle = async () => {
    setToggling(true);
    try {
      const result = await togglePublish(chatbotId);
      onPublishChange(result.is_public);
    } catch { /* ignore */ }
    finally { setToggling(false); }
  };

  const copyToClipboard = async (text: string, type: "link" | "embed") => {
    await navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "#00000080" }}>
      <div
        className="rounded-xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ backgroundColor: "#2D2B33"}}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #715A5A30" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#D3DAD9" }}>Export {chatbotName}</h2>
            <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>Share your chatbot with the world</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer transition-all hover:brightness-125"
            style={{ backgroundColor: "#37353E" }}
          >
            <X className="w-4 h-4" style={{ color: "#D3DAD9" }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Publish Toggle */}
          <div
            className="flex items-center justify-between px-4 py-4 rounded-lg"
            style={{ backgroundColor: "#37353E"}}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: published ? "#22c55e20" : "#9ca3af20" }}
              >
                <Globe className="w-4 h-4" style={{ color: published ? "#22c55e" : "#9ca3af" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#D3DAD9" }}>
                  {published ? "Published" : "Unpublished"}
                </p>
                <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                  {published ? "Anyone with the link can chat" : "Only you can access this chatbot"}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="w-11 h-6 rounded-full transition-all cursor-pointer flex-shrink-0 relative"
              style={{ backgroundColor: published ? "#22c55e" : "#2D2B33" }}
            >
              <div
                className="rounded-full absolute top-[3px] transition-all"
                style={{
                  width: "18px",
                  height: "18px",
                  backgroundColor: published ? "#ffffff" : "#715A5A",
                  left: published ? "22px" : "3px",
                }}
              />
            </button>
          </div>

          {/* Content (only show when published) */}
          {published && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: "#37353E" }}>
                <button
                  onClick={() => setActiveTab("link")}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all cursor-pointer"
                  style={{
                    backgroundColor: activeTab === "link" ? "#715A5A" : "transparent",
                    color: "#D3DAD9",
                    opacity: activeTab === "link" ? 1 : 0.5,
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Shareable Link
                </button>
                <button
                  onClick={() => setActiveTab("embed")}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all cursor-pointer"
                  style={{
                    backgroundColor: activeTab === "embed" ? "#715A5A" : "transparent",
                    color: "#D3DAD9",
                    opacity: activeTab === "embed" ? 1 : 0.5,
                  }}
                >
                  <Code className="w-3.5 h-3.5" />
                  Embed Code
                </button>
              </div>

              {/* Shareable Link Tab */}
              {activeTab === "link" && (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "#D3DAD9", opacity: 0.5 }}>
                    Share this link with anyone — no account required to chat.
                  </p>
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                    style={{ backgroundColor: "#37353E" }}
                  >
                    <input
                      type="text"
                      value={publicUrl}
                      readOnly
                      className="flex-1 bg-transparent outline-none text-xs"
                      style={{ color: "#D3DAD9" }}
                    />
                    <button
                      onClick={() => copyToClipboard(publicUrl, "link")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all hover:brightness-110"
                      style={{ backgroundColor: copiedLink ? "#22c55e" : accentPrimary, color: "#ffffff" }}
                    >
                      {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedLink ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs cursor-pointer"
                    style={{ color: accentPrimary }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Open in new tab
                  </a>
                </div>
              )}

              {/* Embed Code Tab */}
              {activeTab === "embed" && (
                <div className="space-y-4">
                  {/* iframe */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium" style={{ color: "#D3DAD9", opacity: 0.7 }}>iframe Embed</p>
                      <button
                        onClick={() => copyToClipboard(embedCode, "embed")}
                        className="flex items-center gap-1 text-xs cursor-pointer"
                        style={{ color: copiedEmbed ? "#22c55e" : accentPrimary }}
                      >
                        {copiedEmbed ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedEmbed ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre
                      className="px-3 py-3 rounded-lg text-[11px] overflow-x-auto"
                      style={{ backgroundColor: "#37353E", color: "#D3DAD9", opacity: 0.7, }}
                    >
                      {embedCode}
                    </pre>
                  </div>

                  {/* Widget Script */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium" style={{ color: "#D3DAD9", opacity: 0.7 }}>
                        Widget Script
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#715A5A40", opacity: 0.6 }}>
                          Coming Soon
                        </span>
                      </p>
                    </div>
                    <pre
                      className="px-3 py-3 rounded-lg text-[11px] overflow-x-auto"
                      style={{ backgroundColor: "#37353E", color: "#D3DAD9", opacity: 0.4, }}
                    >
                      {widgetCode}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}