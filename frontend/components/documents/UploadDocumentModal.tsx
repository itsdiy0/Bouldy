"use client";

import { useState } from "react";
import { X, Upload, AlertCircle } from "lucide-react";
import { uploadDocument, Document } from "@/lib/api";

interface UploadDocumentModalProps {
  onClose: () => void;
  onUploaded: (doc: Document) => void;
}

export default function UploadDocumentModal({ onClose, onUploaded }: UploadDocumentModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const doc = await uploadDocument(file);
        onUploaded(doc);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "#00000080" }}>
      <div
        className="rounded-xl w-full max-w-md mx-4 overflow-hidden"
        style={{ backgroundColor: "#2D2B33" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #715A5A30" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#D3DAD9" }}>Upload Documents</h2>
            <p className="text-xs mt-0.5" style={{ color: "#D3DAD9", opacity: 0.4 }}>PDF, DOCX, or TXT — up to 50MB</p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 rounded-lg cursor-pointer transition-all hover:brightness-125"
            style={{ backgroundColor: "#37353E" }}
          >
            <X className="w-4 h-4" style={{ color: "#D3DAD9" }} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#ef444420", color: "#ef4444" }}>
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div
            className={`flex flex-col items-center justify-center gap-3 px-4 py-12 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
              dragActive ? "border-white bg-white/5" : "border-gray-600"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isUploading && document.getElementById("modal-file-upload")?.click()}
          >
            <input
              type="file"
              id="modal-file-upload"
              className="hidden"
              accept=".pdf,.docx,.txt"
              multiple
              onChange={(e) => handleUpload(e.target.files)}
              disabled={isUploading}
            />
            <Upload className="w-8 h-8" style={{ color: "#D3DAD9", opacity: 0.6 }} />
            <span className="text-sm" style={{ color: "#D3DAD9", opacity: 0.7 }}>
              {isUploading ? "Uploading..." : "Drop files here or click to upload"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}