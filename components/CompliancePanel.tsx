"use client";

import { useState } from "react";

interface RequirementResult {
  requirement: string;
  status: "MET" | "PARTIALLY_MET" | "NOT_MET" | "NOT_APPLICABLE";
  evidence: string;
  suggestion: string;
}

interface ComplianceResult {
  overall_compliance: "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT";
  compliance_score: number;
  requirements_checked: RequirementResult[];
  missing_sections: string[];
  warnings: string[];
}

interface CompliancePanelProps {
  opportunityId: string;
  proposalText: string;
  onFixRequest: (suggestions: string) => void;
}

export default function CompliancePanel({
  opportunityId,
  proposalText,
  onFixRequest,
}: CompliancePanelProps) {
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    if (!proposalText.trim()) {
      setError("No proposal text to check.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/compliance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId, proposalText }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Compliance check failed");
      }

      const data: ComplianceResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleFixAll() {
    if (!result) return;
    const suggestions = result.requirements_checked
      .filter((r) => r.status !== "MET" && r.status !== "NOT_APPLICABLE" && r.suggestion)
      .map((r) => `- ${r.requirement}: ${r.suggestion}`)
      .join("\n");

    const missingSections = result.missing_sections.length > 0
      ? "\n\nMissing sections to add:\n" + result.missing_sections.map((s) => `- ${s}`).join("\n")
      : "";

    onFixRequest(suggestions + missingSections);
  }

  const complianceColor = {
    COMPLIANT: "text-green-400 bg-green-400/10 border-green-400/30",
    PARTIALLY_COMPLIANT: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    NON_COMPLIANT: "text-red-400 bg-red-400/10 border-red-400/30",
  };

  const statusIcon = {
    MET: { icon: "\u2713", color: "text-green-400" },
    PARTIALLY_MET: { icon: "!", color: "text-amber-400" },
    NOT_MET: { icon: "\u2717", color: "text-red-400" },
    NOT_APPLICABLE: { icon: "-", color: "text-[#A0A0A0]" },
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={runCheck}
          disabled={loading}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
        >
          {loading ? "Checking..." : result ? "Re-Check" : "Check Compliance"}
        </button>
        {result && (
          <button
            onClick={handleFixAll}
            className="flex-1 px-3 py-2 bg-[#1A1A1A] hover:bg-[#222] border border-white/[0.07] text-[#F5F5F5] text-xs font-medium rounded transition-colors"
          >
            Fix All Issues
          </button>
        )}
      </div>

      {/* Loading bar */}
      {loading && (
        <div className="w-full h-1 bg-[#1A1A1A] rounded overflow-hidden">
          <div className="h-full bg-blue-600 rounded animate-pulse" style={{ width: "60%" }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
          {/* Overall badge */}
          <div className={`flex items-center justify-between px-3 py-2 rounded border ${complianceColor[result.overall_compliance]}`}>
            <span className="text-xs font-semibold">
              {result.overall_compliance.replace(/_/g, " ")}
            </span>
            <span className="text-sm font-bold">{result.compliance_score}%</span>
          </div>

          {/* Requirements list */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
              Requirements ({result.requirements_checked.length})
            </h4>
            {result.requirements_checked.map((req, i) => {
              const si = statusIcon[req.status];
              return (
                <div
                  key={i}
                  className="bg-[#1A1A1A] border border-white/[0.07] rounded p-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-start gap-2">
                    <span className={`text-sm font-bold flex-shrink-0 w-4 text-center ${si.color}`}>
                      {si.icon}
                    </span>
                    <span className="text-xs text-[#F5F5F5] leading-snug">
                      {req.requirement}
                    </span>
                  </div>
                  {req.evidence && (
                    <p className="text-[10px] text-[#A0A0A0] ml-6 leading-snug">
                      <span className="font-medium text-[#888]">Evidence:</span> {req.evidence}
                    </p>
                  )}
                  {req.suggestion && req.status !== "MET" && (
                    <p className="text-[10px] text-amber-400/80 ml-6 leading-snug">
                      <span className="font-medium">Suggestion:</span> {req.suggestion}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Missing sections */}
          {result.missing_sections.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
                Missing Sections
              </h4>
              <ul className="flex flex-col gap-1">
                {result.missing_sections.map((section, i) => (
                  <li
                    key={i}
                    className="text-xs text-red-400 bg-red-400/5 border border-red-400/10 rounded px-3 py-1.5"
                  >
                    {section}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">
                Warnings
              </h4>
              <ul className="flex flex-col gap-1">
                {result.warnings.map((warning, i) => (
                  <li
                    key={i}
                    className="text-xs text-amber-400 bg-amber-400/5 border border-amber-400/10 rounded px-3 py-1.5"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[#A0A0A0] text-center">
            Run a compliance check to compare your proposal against the tender requirements.
          </p>
        </div>
      )}
    </div>
  );
}
