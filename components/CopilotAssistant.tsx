"use client";

import { useState } from "react";

interface CopilotAssistantProps {
  selectedText: string;
  fullContent: string;
  opportunityId: string;
  onApply: (newText: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const QUICK_ACTIONS = [
  { label: "Make more technical", instruction: "Make this text more technical and precise, using industry-specific terminology." },
  { label: "Make more concise", instruction: "Make this text more concise while preserving the key points." },
  { label: "Expand this section", instruction: "Expand this section with more detail and supporting points." },
  { label: "Add specific examples", instruction: "Add specific, concrete examples to support the claims in this text." },
  { label: "Improve persuasiveness", instruction: "Make this text more persuasive and compelling for a procurement evaluator." },
];

export default function CopilotAssistant({
  selectedText,
  fullContent,
  opportunityId,
  onApply,
  onClose,
  position,
}: CopilotAssistantProps) {
  const [customInstruction, setCustomInstruction] = useState("");
  const [useKnowledge, setUseKnowledge] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(instruction: string, actionKey: string) {
    setLoadingAction(actionKey);
    setError(null);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          instruction,
          fullProposalContext: fullContent,
          opportunityId,
          useKnowledge,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Copilot request failed");
      }

      const data = await res.json();
      onApply(data.revisedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingAction(null);
    }
  }

  function handleCustomSubmit() {
    if (!customInstruction.trim()) return;
    handleAction(customInstruction.trim(), "custom");
  }

  // When used as a floating popover, apply position; when inline (sidebar), skip positioning
  const isInline = position.top === 0 && position.left === 0;

  return (
    <div
      className={`bg-[#1A1A1A] border border-white/[0.07] rounded-lg shadow-lg flex flex-col gap-3 p-3 z-50 ${
        isInline ? "w-full" : "fixed w-72"
      }`}
      style={isInline ? undefined : { top: position.top, left: position.left }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#F5F5F5]">AI Copilot</span>
        {!isInline && (
          <button
            onClick={onClose}
            className="text-[#A0A0A0] hover:text-[#F5F5F5] text-sm transition-colors"
          >
            x
          </button>
        )}
      </div>

      {/* Selected text preview */}
      {selectedText && (
        <div className="text-[10px] text-[#A0A0A0] bg-[#141414] rounded px-2 py-1.5 max-h-16 overflow-y-auto border border-white/[0.05]">
          <span className="text-[#666] font-medium">Selected: </span>
          {selectedText.length > 200 ? selectedText.slice(0, 200) + "..." : selectedText}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[#A0A0A0] uppercase tracking-wider font-medium">
          Quick Actions
        </span>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleAction(action.instruction, action.label)}
            disabled={loadingAction !== null || !selectedText}
            className="text-left px-2.5 py-1.5 text-xs text-[#F5F5F5] bg-[#141414] hover:bg-[#1E1E1E] border border-white/[0.07] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
          >
            <span>{action.label}</span>
            {loadingAction === action.label && (
              <span className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Custom instruction */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[#A0A0A0] uppercase tracking-wider font-medium">
          Custom Instruction
        </span>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomSubmit();
            }}
            placeholder="e.g. Add a case study reference..."
            className="flex-1 bg-[#141414] border border-white/[0.07] rounded px-2.5 py-1.5 text-xs text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-blue-600/50"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={loadingAction !== null || !customInstruction.trim() || !selectedText}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
          >
            {loadingAction === "custom" ? (
              <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>

      {/* Knowledge toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={useKnowledge}
          onChange={(e) => setUseKnowledge(e.target.checked)}
          className="w-3 h-3 rounded border-white/[0.07] bg-[#141414] accent-blue-600"
        />
        <span className="text-[10px] text-[#A0A0A0]">Use company knowledge</span>
      </label>

      {/* Error */}
      {error && (
        <div className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1.5">
          {error}
        </div>
      )}
    </div>
  );
}
