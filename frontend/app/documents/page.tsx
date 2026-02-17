"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, FileText, Trash2, Grid, List, AlertCircle, File, Bot, Check } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getDocuments, uploadDocument, deleteDocument, Document } from "@/lib/api";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const fileTypeColors: Record<string, string> = {
  pdf: "#ef4444",
  docx: "#3b82f6",
  txt: "#9ca3af",
};

const statusConfig: Record<string, { color: string; label: string }> = {
  uploaded: { color: "#9ca3af", label: "Uploaded" },
  processing: { color: "#eab308", label: "Processing" },
  ready: { color: "#22c55e", label: "Ready" },
  failed: { color: "#ef4444", label: "Failed" },
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    try {
      const data = await getDocuments();
      setDocuments(data.documents);
      setError(null);
    } catch {
      setError("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(file);
      }
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        await deleteDocument(id);
      }
      setSelectedIds(new Set());
      await fetchDocuments();
    } catch {
      setError("Failed to delete documents");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (id: string, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      toggleSelect(id);
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  const handleCreateChatbot = () => {
    console.log("Create chatbot with documents:", Array.from(selectedIds));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col p-6">
        {/* Error Message */}
        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg mb-4"
            style={{ backgroundColor: "#ef444420", color: "#ef4444" }}
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-4 py-2 rounded-lg mb-4"
          style={{ backgroundColor: "#715A5A40" }}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4" style={{ color: "#D3DAD9", opacity: 0.7 }} />
            <span className="text-sm" style={{ color: "#D3DAD9", opacity: 0.7 }}>
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </span>
            {documents.length > 0 && (
              <button
                onClick={() => {
                  if (selectedIds.size === documents.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(documents.map((d) => d.id)));
                  }
                }}
                className="text-xs px-2 py-1 rounded transition-all cursor-pointer"
                style={{ color: "#D3DAD9", opacity: 0.5 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.backgroundColor = "#715A5A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                {selectedIds.size === documents.length ? "Deselect All" : "Select All"}
              </button>
            )}
            {selectedIds.size > 0 && (
              <>
                <span style={{ color: "#D3DAD9", opacity: 0.3 }}>•</span>
                <span className="text-sm" style={{ color: "#D3DAD9" }}>
                  {selectedIds.size} selected
                </span>
                {selectedIds.size === 1 && (
                  <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
                    (⌘+click for multiple)
                  </span>
                )}
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors hover:bg-red-500/20"
                  style={{ color: "#ef4444" }}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
                <button
                  onClick={handleCreateChatbot}
                  className="flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors"
                  style={{ color: "#D3DAD9" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#715A5A")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <Bot className="w-3 h-3" />
                  Create Chatbot
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className="p-2 rounded transition-colors"
              style={{
                backgroundColor: viewMode === "grid" ? "#715A5A" : "transparent",
                color: "#D3DAD9",
              }}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="p-2 rounded transition-colors"
              style={{
                backgroundColor: viewMode === "list" ? "#715A5A" : "transparent",
                color: "#D3DAD9",
              }}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File Manager Area */}
        <div
          className="flex-1 rounded-lg p-4 overflow-auto mb-4"
          style={{ backgroundColor: "#715A5A20" }}
          onClick={() => setSelectedIds(new Set())}
        >
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <p style={{ color: "#D3DAD9", opacity: 0.6 }}>Loading...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <FileText className="w-16 h-16 mb-4" style={{ color: "#D3DAD9", opacity: 0.2 }} />
              <p style={{ color: "#D3DAD9", opacity: 0.5 }}>No documents yet</p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {documents.map((doc) => {
                const status = statusConfig[doc.status] || statusConfig.uploaded;
                return (
                  <div
                    key={doc.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(doc.id, e);
                    }}
                    className="relative flex flex-col items-center p-3 rounded-lg cursor-pointer transition-colors group"
                    style={{
                      backgroundColor: selectedIds.has(doc.id) ? "#715A5A" : "transparent",
                    }}
                  >
                    {/* Select Circle */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(doc.id);
                      }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all opacity-40 group-hover:opacity-100 hover:scale-110"
                      style={{
                        borderColor: selectedIds.has(doc.id) ? "#D3DAD9" : "#D3DAD9",
                        backgroundColor: selectedIds.has(doc.id) ? "#D3DAD9" : "transparent",
                        opacity: selectedIds.has(doc.id) ? 1 : undefined,
                      }}
                    >
                      {selectedIds.has(doc.id) && <Check className="w-3 h-3" style={{ color: "#37353E" }} />}
                    </div>

                    {/* Status Dot */}
                    <div
                      className="absolute top-2 left-2 w-2 h-2 rounded-full"
                      style={{ backgroundColor: status.color }}
                      title={status.label}
                    />

                    <div className="relative mb-2">
                      <File
                        className="w-12 h-12"
                        style={{ color: fileTypeColors[doc.file_type] || "#9ca3af" }}
                      />
                      <span
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold px-1 rounded"
                        style={{ backgroundColor: "#37353E", color: "#D3DAD9" }}
                      >
                        {doc.file_type.toUpperCase()}
                      </span>
                    </div>
                    <p
                      className="text-xs text-center truncate w-full"
                      style={{ color: "#D3DAD9" }}
                      title={doc.original_filename}
                    >
                      {doc.original_filename}
                    </p>
                    <p className="text-[10px]" style={{ color: "#D3DAD9", opacity: 0.5 }}>
                      {formatFileSize(doc.file_size)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {documents.map((doc) => {
                const status = statusConfig[doc.status] || statusConfig.uploaded;
                return (
                  <div
                    key={doc.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(doc.id, e);
                    }}
                    className="flex items-center gap-4 px-3 py-2 rounded cursor-pointer transition-colors group"
                    style={{
                      backgroundColor: selectedIds.has(doc.id) ? "#715A5A" : "transparent",
                    }}
                  >
                    {/* Select Circle */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(doc.id);
                      }}
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
                      style={{
                        borderColor: "#D3DAD9",
                        backgroundColor: selectedIds.has(doc.id) ? "#D3DAD9" : "transparent",
                        opacity: selectedIds.has(doc.id) ? 1 : 0.4,
                      }}
                    >
                      {selectedIds.has(doc.id) && <Check className="w-3 h-3" style={{ color: "#37353E" }} />}
                    </div>
                    <File
                      className="w-5 h-5 flex-shrink-0"
                      style={{ color: fileTypeColors[doc.file_type] || "#9ca3af" }}
                    />
                    <span className="flex-1 text-sm truncate" style={{ color: "#D3DAD9" }}>
                      {doc.original_filename}
                    </span>
                    {/* Status Badge */}
                    <span
                      className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: status.color + "20", color: status.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                      {status.label}
                    </span>
                    <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.5 }}>
                      {formatFileSize(doc.file_size)}
                    </span>
                    <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.5 }}>
                      {formatDate(doc.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Upload Bar */}
        <div
          className={`flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
            dragActive ? "border-white bg-white/5" : "border-gray-600"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            disabled={isUploading}
          />
          <Upload className="w-5 h-5" style={{ color: "#D3DAD9", opacity: 0.6 }} />
          <span className="text-sm" style={{ color: "#D3DAD9", opacity: 0.6 }}>
            {isUploading ? "Uploading..." : "Drop files here or click to upload"}
          </span>
          <span className="text-xs" style={{ color: "#D3DAD9", opacity: 0.4 }}>
            PDF, DOCX, TXT
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}