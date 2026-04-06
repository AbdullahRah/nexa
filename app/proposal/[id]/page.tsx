"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import ProposalEditor from "@/components/ProposalEditor";
import CopilotAssistant from "@/components/CopilotAssistant";
import CompliancePanel from "@/components/CompliancePanel";
import Link from "next/link";

interface Opportunity {
  id: string;
  title: string | null;
  buyer_name: string | null;
  description_raw: string | null;
  tender_deadline: string | null;
}

interface ProposalDraft {
  id: string;
  content: string;
  version: number;
}

export default function ProposalEditorPage() {
  const params = useParams();
  const opportunityId = params.id as string;

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [draft, setDraft] = useState<ProposalDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [noDraft, setNoDraft] = useState(false);
  const [activeTab, setActiveTab] = useState<"copilot" | "compliance">("copilot");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [editorContent, setEditorContent] = useState("");
  const [selectedText, setSelectedText] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef("");

  // Fetch opportunity and draft data
  useEffect(() => {
    async function load() {
      try {
        const [oppRes, draftRes] = await Promise.all([
          fetch(`/api/opportunities/${opportunityId}`),
          fetch(`/api/proposals?opportunityId=${opportunityId}`),
        ]);

        if (oppRes.ok) {
          const oppData = await oppRes.json();
          setOpportunity(oppData);
        }

        if (draftRes.ok) {
          const draftData = await draftRes.json();
          if (draftData.draft) {
            setDraft(draftData.draft);
            setEditorContent(draftData.draft.content);
            contentRef.current = draftData.draft.content;
          } else {
            setNoDraft(true);
          }
        } else {
          setNoDraft(true);
        }
      } catch (err) {
        console.error("Failed to load proposal data:", err);
        setNoDraft(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [opportunityId]);

  // Auto-save with debounce
  const saveContent = useCallback(
    async (content: string) => {
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opportunityId, content }),
        });
        if (res.ok) {
          const data = await res.json();
          setDraft(data.draft);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("idle");
        }
      } catch {
        setSaveStatus("idle");
      }
    },
    [opportunityId]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      contentRef.current = content;
      setEditorContent(content);

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(() => {
        saveContent(content);
      }, 3000);
    },
    [saveContent]
  );

  // Cleanup save timer
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  // Listen for text selection changes
  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      setSelectedText(text);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  function handleCopilotApply(newText: string) {
    // The copilot returns revised text; we append it as a suggestion
    // In a full implementation this would replace the selected text in the editor
    setEditorContent((prev) => {
      const updated = selectedText
        ? prev.replace(selectedText, newText)
        : prev + "\n\n" + newText;
      contentRef.current = updated;
      // Trigger a save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveContent(updated), 1000);
      return updated;
    });
  }

  function handleComplianceFix() {
    // Append the fix suggestions as an instruction to the copilot
    setActiveTab("copilot");
    setSelectedText(editorContent);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
        <Header maxWidthClass="max-w-full w-full px-4" />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (noDraft) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
        <Header maxWidthClass="max-w-full w-full px-4" />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-[#A0A0A0] text-sm">
            No proposal draft found for this opportunity.
          </p>
          <p className="text-[#A0A0A0] text-xs">
            Generate a proposal first from the opportunity page.
          </p>
          <Link
            href="/dashboard"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors border border-blue-400/30 rounded px-4 py-2"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] flex flex-col">
      <Header maxWidthClass="max-w-full w-full px-4" />

      {/* Title bar */}
      <div className="border-b border-white/[0.07] px-6 py-3 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-sm font-semibold text-[#F5F5F5] truncate max-w-xl">
            {opportunity?.title ?? "Proposal Editor"}
          </h1>
          {opportunity?.buyer_name && (
            <span className="text-[10px] text-[#A0A0A0]">{opportunity.buyer_name}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {draft && (
            <span className="text-[10px] text-[#A0A0A0]">v{draft.version}</span>
          )}
          <span
            className={`text-[10px] font-medium ${
              saveStatus === "saving"
                ? "text-amber-400"
                : saveStatus === "saved"
                ? "text-green-400"
                : "text-[#555]"
            }`}
          >
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
              ? "Saved"
              : ""}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor — left 70% */}
        <div className="w-[70%] p-4 overflow-y-auto">
          <ProposalEditor
            initialContent={editorContent}
            opportunityId={opportunityId}
            onContentChange={handleContentChange}
          />
        </div>

        {/* Sidebar — right 30% */}
        <div className="w-[30%] border-l border-white/[0.07] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.07]">
            <button
              onClick={() => setActiveTab("copilot")}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                activeTab === "copilot"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-[#A0A0A0] hover:text-[#F5F5F5]"
              }`}
            >
              Copilot
            </button>
            <button
              onClick={() => setActiveTab("compliance")}
              className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                activeTab === "compliance"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-[#A0A0A0] hover:text-[#F5F5F5]"
              }`}
            >
              Compliance
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 p-3 overflow-y-auto">
            {activeTab === "copilot" && (
              <CopilotAssistant
                selectedText={selectedText}
                fullContent={editorContent}
                opportunityId={opportunityId}
                onApply={handleCopilotApply}
                onClose={() => {}}
                position={{ top: 0, left: 0 }}
              />
            )}
            {activeTab === "compliance" && (
              <CompliancePanel
                opportunityId={opportunityId}
                proposalText={editorContent}
                onFixRequest={handleComplianceFix}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
