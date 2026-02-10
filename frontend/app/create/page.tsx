"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Check, File, Bot, Settings, Sparkles,BotIcon, Search } from "lucide-react";
import ProviderIcon from "@/components/ui/ProviderIcon";
import { getDocuments, createChatbot, Document, CreateChatbotData } from "@/lib/api";

const STEPS = [
  { id: 1, name: "Basics", icon: Bot },
  { id: 2, name: "Documents", icon: File },
  { id: 3, name: "LLM", icon: Settings },
  { id: 4, name: "Review", icon: Sparkles },
];

const LLM_PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"], color: "#10a37f", bg: "#10a37f20" },
  { id: "anthropic", name: "Anthropic", models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"], color: "#d4a574", bg: "#d4a57420" },
  { id: "gemini", name: "Google Gemini", models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"], color: "#8E75B2", bg: "#8E75B220" },
  { id: "ollama", name: "Ollama", models: ["llama3", "llama2", "mistral", "codellama"], color: "#ffffff", bg: "#ffffff15" },
  { id: "grok", name: "Grok (xAI)", models: ["grok-2", "grok-2-mini", "grok-beta"], color: "#000000", bg: "#ffffff15" },
];

const fileTypeColors: Record<string, string> = { pdf: "#ef4444", docx: "#3b82f6", txt: "#9ca3af" };

export default function CreateChatbotPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    async function fetchDocs() {
      try {
        const data = await getDocuments();
        setDocuments(data.documents);
      } catch {
        setError("Failed to load documents");
      } finally {
        setLoadingDocs(false);
      }
    }
    fetchDocs();
  }, []);

  const toggleDocument = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return selectedDocIds.size > 0;
      case 3: return provider && model;
      case 4: return true;
      default: return false;
    }
  };

  const canNavigateTo = (step: number) => {
    if (step < currentStep) return true;
    for (let i = 1; i < step; i++) {
      if (!isStepComplete(i)) return false;
    }
    return true;
  };

  const handleStepClick = (step: number) => {
    if (canNavigateTo(step)) setCurrentStep(step);
  };

  const handleCreate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data: CreateChatbotData = {
        name,
        description: description || undefined,
        document_ids: Array.from(selectedDocIds),
        llm_provider: provider,
        llm_model: model,
        api_key: apiKey || undefined,
      };
      await createChatbot(data);
      router.push("/chatbots");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chatbot");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedProvider = LLM_PROVIDERS.find((p) => p.id === provider);
  const filteredDocuments = documents.filter((doc) =>
    doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-3xl rounded-xl p-8" style={{ backgroundColor: "#2D2B33", border: "1px solid #715A5A40" }}>
          {/* Header with Steps */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold" style={{ color: "#D3DAD9" }}>Create Chatbot</h1>
            <div className="flex items-center gap-1">
              {STEPS.map((step, idx) => {
                const isActive = currentStep === step.id;
                const isComplete = isStepComplete(step.id) && currentStep > step.id;
                const canClick = canNavigateTo(step.id);
                return (
                  <div key={step.id} className="flex items-center">
                    <button
                      onClick={() => handleStepClick(step.id)}
                      disabled={!canClick}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all"
                      style={{
                        backgroundColor: isActive ? "#715A5A" : isComplete ? "#715A5A60" : "transparent",
                        color: "#D3DAD9",
                        opacity: canClick ? 1 : 0.3,
                        cursor: canClick ? "pointer" : "not-allowed",
                      }}
                    >
                      {isComplete ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                      <span className="text-xs font-medium hidden sm:inline">{step.name}</span>
                    </button>
                    {idx < STEPS.length - 1 && (
                      <div className="w-3 h-px mx-0.5" style={{ backgroundColor: isComplete ? "#715A5A" : "#715A5A40" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg mb-4 text-sm" style={{ backgroundColor: "#ef444420", color: "#ef4444" }}>
              {error}
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[320px]">
            {/* Step 1: Basics */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Knowledge Assistant"
                    className="w-full px-4 py-3 rounded-lg outline-none text-sm"
                    style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A helpful assistant that answers questions about..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg outline-none resize-none text-sm"
                    style={{ backgroundColor: "#37353E", color: "#D3DAD9", border: "1px solid #715A5A" }}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Documents */}
            {currentStep === 2 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 max-w-[240px]" style={{ backgroundColor: "#37353E", border: "1px solid #715A5A" }}>
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
                  <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.6 }}>
                    {selectedDocIds.size} of {documents.length} selected
                  </span>
                </div>
                {loadingDocs ? (
                  <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.6 }}>Loading...</p>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12">
                    <File className="w-12 h-12 mx-auto mb-3" style={{ color: "#D3DAD9", opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: "#D3DAD9", opacity: 0.6 }}>No documents uploaded</p>
                    <button onClick={() => router.push("/documents")} className="mt-3 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "#715A5A", color: "#D3DAD9" }}>
                      Upload Documents
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-[240px] overflow-auto">
                    {filteredDocuments.map((doc) => (
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

            {/* Step 3: LLM Config */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm mb-3" style={{ color: "#D3DAD9", opacity: 0.7 }}>Provider *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {LLM_PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setProvider(p.id); setModel(""); }}
                        className="px-4 py-3 rounded-lg text-left transition-all flex items-center gap-3"
                        style={{
                          backgroundColor: provider === p.id ? p.bg : "#37353E",
                          border: provider === p.id ? `2px solid ${p.color}` : "2px solid transparent",
                        }}
                      >
                        <ProviderIcon provider={p.id} size={30} color={p.color} />
                        <span className="text-sm font-medium" style={{ color: "#D3DAD9" }}>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {provider && (
                  <div>
                    <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>Model *</label>
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
                    <label className="block text-sm mb-2" style={{ color: "#D3DAD9", opacity: 0.7 }}>API Key *</label>
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

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-3">
                {[
                  { label: "Name", value: name },
                  { label: "Description", value: description || "—" },
                  { label: "Documents", value: `${selectedDocIds.size} selected` },
                  { label: "Provider", value: LLM_PROVIDERS.find((p) => p.id === provider)?.name },
                  { label: "Model", value: model },
                  { label: "API Key", value: apiKey ? "••••••••" : "—" },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    className={`flex justify-between py-3 ${i < arr.length - 1 ? "border-b" : ""}`}
                    style={{ borderColor: "#715A5A40" }}
                  >
                    <span className="text-sm" style={{ color: "#D3DAD9", opacity: 0.6 }}>{row.label}</span>
                    <span className="text-sm font-medium truncate max-w-[300px]" style={{ color: "#D3DAD9" }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-between mt-6 pt-5 border-t" style={{ borderColor: "#715A5A40" }}>
            <button
              onClick={() => setCurrentStep((s) => s - 1)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: "transparent",
                color: "#D3DAD9",
                border: "1px solid #715A5A",
                opacity: currentStep === 1 ? 0 : 1,
                pointerEvents: currentStep === 1 ? "none" : "auto",
                cursor:"pointer"
              }}
            >
              Back
            </button>
            {currentStep < 4 ? (
              <button
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={!isStepComplete(currentStep)}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: isStepComplete(currentStep) ? "#715A5A" : "#715A5A60",
                  color: "#D3DAD9",
                  opacity: isStepComplete(currentStep) ? 1 : 0.5,
                  cursor:"pointer"
                }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: "#715A5A",
                  color: "#D3DAD9",
                  opacity: isLoading ? 0.6 : 1,
                  cursor:"pointer"
                }}
              >
                {isLoading ? "Creating..." : "Create Chatbot"}
                <BotIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}