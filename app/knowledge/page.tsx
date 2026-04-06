"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";

interface KnowledgeDoc {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  _count: { chunks: number };
}

const FILE_TYPE_OPTIONS = [
  { value: "proposal", label: "Past Proposal" },
  { value: "cv", label: "Employee CV" },
  { value: "case_study", label: "Case Study" },
  { value: "cert", label: "Compliance Certificate" },
  { value: "company_profile", label: "Company Profile" },
  { value: "other", label: "Other" },
];

const FILE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FILE_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileType, setFileType] = useState("proposal");
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function uploadFile(file: File) {
    if (uploading) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "docx", "doc", "txt"].includes(ext)) {
      alert("Invalid file type. Allowed: PDF, DOCX, TXT");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", fileType);

      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchDocuments();
      } else {
        const err = await res.json().catch(() => null);
        alert(err?.error ?? "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleDelete(documentId: string) {
    if (deletingId) return;
    setDeletingId(documentId);
    try {
      const res = await fetch("/api/knowledge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      } else {
        alert("Failed to delete document");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-[#F5F5F5] mb-1">
            Knowledge Base
          </h1>
          <p className="text-sm text-[#A0A0A0]">
            Upload company documents to enhance AI-generated proposals.
          </p>
        </div>

        {/* Upload Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-[#A0A0A0]">Document type</label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className="bg-[#1A1A1A] border border-white/[0.07] rounded text-xs text-[#F5F5F5] px-3 py-1.5 focus:outline-none focus:border-white/[0.15] transition-colors"
            >
              {FILE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
              dragOver
                ? "border-blue-500/60 bg-blue-500/5"
                : "border-white/[0.12] bg-[#141414] hover:border-white/[0.20]"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#A0A0A0]">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <svg
                  className="w-8 h-8 text-[#A0A0A0]/50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div>
                  <p className="text-sm text-[#F5F5F5] mb-1">
                    Drag and drop a file here, or{" "}
                    <label className="text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
                      browse
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </p>
                  <p className="text-xs text-[#A0A0A0]/60">
                    PDF, DOCX, TXT — Max 10MB
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Documents List */}
        <div>
          <h2 className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider mb-4">
            Uploaded Documents
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-[#A0A0A0]/30 border-t-[#A0A0A0] rounded-full animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-16 border border-white/[0.07] rounded-lg bg-[#141414]">
              <p className="text-sm text-[#A0A0A0] mb-1">
                No documents uploaded yet.
              </p>
              <p className="text-xs text-[#A0A0A0]/60">
                Upload your company documents to enhance AI proposals.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-[#141414] border border-white/[0.07] rounded-[6px] p-5 hover:border-white/[0.14] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-medium text-[#F5F5F5] truncate flex-1">
                      {doc.file_name}
                    </h3>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="shrink-0 text-[#A0A0A0]/40 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm leading-none disabled:opacity-50"
                      title="Delete document"
                    >
                      {deletingId === doc.id ? (
                        <div className="w-3.5 h-3.5 border border-red-400/60 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono text-blue-400/70 bg-blue-400/10 border border-blue-400/10 px-1.5 py-0.5 rounded">
                      {FILE_TYPE_LABELS[doc.file_type] ?? doc.file_type}
                    </span>
                    {doc.status === "ready" && (
                      <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-400/10 border border-emerald-400/10 px-1.5 py-0.5 rounded">
                        Ready
                      </span>
                    )}
                    {doc.status === "processing" && (
                      <span className="text-[10px] font-mono text-amber-400/80 bg-amber-400/10 border border-amber-400/10 px-1.5 py-0.5 rounded animate-pulse">
                        Processing
                      </span>
                    )}
                    {doc.status === "error" && (
                      <span className="text-[10px] font-mono text-red-400/80 bg-red-400/10 border border-red-400/10 px-1.5 py-0.5 rounded">
                        Error
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#A0A0A0]/60">
                    <span>{formatDate(doc.created_at)}</span>
                    <div className="flex items-center gap-3">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>{doc._count.chunks} chunks</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
