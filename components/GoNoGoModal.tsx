"use client";

import { useEffect } from "react";

interface GoNoGoAnalysis {
  recommendation: string;
  confidence: string;
  reasoning: string;
  time_to_submit: string;
  mandatory_requirements: { requirement: string; critical: boolean }[];
  deadlines: { date: string; description: string }[];
  financial_thresholds: { description: string; value: string }[];
  experience_requirements: string[];
  geographical_constraints: string[];
  red_flags: string[];
}

interface GoNoGoModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: GoNoGoAnalysis | null;
  loading: boolean;
  opportunityTitle?: string;
}

const RECOMMENDATION_STYLES: Record<string, string> = {
  GO: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "NO-GO": "bg-red-500/20 text-red-400 border-red-500/30",
  CONDITIONAL: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: "bg-emerald-500/10 text-emerald-400",
  MEDIUM: "bg-amber-500/10 text-amber-400",
  LOW: "bg-red-500/10 text-red-400",
};

export default function GoNoGoModal({
  isOpen,
  onClose,
  analysis,
  loading,
  opportunityTitle,
}: GoNoGoModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl max-h-[85vh] bg-[#1A1A1A] border border-white/[0.07] rounded-lg shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-[#F5F5F5]">
                Go / No-Go Analysis
              </h2>
              {opportunityTitle && (
                <p className="text-xs text-[#A0A0A0] truncate mt-0.5">
                  {opportunityTitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 ml-4 text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-6 py-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-[#A0A0A0]">
                  Analyzing tender requirements...
                </p>
              </div>
            )}

            {!loading && analysis && (
              <div className="space-y-6">
                {/* Recommendation Badge + Confidence */}
                <div className="flex items-center gap-3">
                  <span
                    className={`text-lg font-bold px-4 py-2 rounded border ${
                      RECOMMENDATION_STYLES[analysis.recommendation] ??
                      RECOMMENDATION_STYLES.CONDITIONAL
                    }`}
                  >
                    {analysis.recommendation}
                  </span>
                  <span
                    className={`text-[11px] font-mono px-2.5 py-1 rounded ${
                      CONFIDENCE_STYLES[analysis.confidence] ??
                      CONFIDENCE_STYLES.MEDIUM
                    }`}
                  >
                    {analysis.confidence} confidence
                  </span>
                </div>

                {/* Time to Submit */}
                {analysis.time_to_submit && (
                  <div className="bg-[#141414] border border-white/[0.07] rounded-lg p-4">
                    <span className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider">
                      Time to Submit
                    </span>
                    <p className="text-xl font-semibold text-[#F5F5F5] mt-1">
                      {analysis.time_to_submit}
                    </p>
                  </div>
                )}

                {/* Reasoning */}
                {analysis.reasoning && (
                  <Section label="Reasoning">
                    <p className="text-sm text-[#A0A0A0] leading-relaxed">
                      {analysis.reasoning}
                    </p>
                  </Section>
                )}

                {/* Mandatory Requirements */}
                {analysis.mandatory_requirements?.length > 0 && (
                  <Section label="Mandatory Requirements">
                    <ul className="space-y-2">
                      {analysis.mandatory_requirements.map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                              req.critical ? "bg-red-400" : "bg-[#A0A0A0]/40"
                            }`}
                          />
                          <span className="text-[#F5F5F5]">
                            {req.requirement}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Deadlines */}
                {analysis.deadlines?.length > 0 && (
                  <Section label="Key Deadlines">
                    <div className="space-y-2">
                      {analysis.deadlines.map((d, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <span className="text-[#F5F5F5]">
                            {d.description}
                          </span>
                          <span className="text-[#A0A0A0] font-mono text-xs shrink-0">
                            {d.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Financial Thresholds */}
                {analysis.financial_thresholds?.length > 0 && (
                  <Section label="Financial Thresholds">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {analysis.financial_thresholds.map((ft, i) => (
                        <div
                          key={i}
                          className="bg-[#141414] border border-white/[0.07] rounded p-3"
                        >
                          <p className="text-xs text-[#A0A0A0] mb-1">
                            {ft.description}
                          </p>
                          <p className="text-sm font-mono text-[#F5F5F5]">
                            {ft.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Experience Requirements */}
                {analysis.experience_requirements?.length > 0 && (
                  <Section label="Experience Requirements">
                    <ul className="space-y-1.5">
                      {analysis.experience_requirements.map((req, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-[#F5F5F5]"
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A0A0A0]/40 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Geographical Constraints */}
                {analysis.geographical_constraints?.length > 0 && (
                  <Section label="Geographical Constraints">
                    <ul className="space-y-1.5">
                      {analysis.geographical_constraints.map((gc, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-[#F5F5F5]"
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A0A0A0]/40 shrink-0" />
                          {gc}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Red Flags */}
                {analysis.red_flags?.length > 0 && (
                  <Section label="Red Flags">
                    <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-4">
                      <ul className="space-y-2">
                        {analysis.red_flags.map((flag, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-amber-300/90"
                          >
                            <span className="mt-0.5 shrink-0 text-xs">
                              !!
                            </span>
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Section>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/[0.07] shrink-0">
            <button
              onClick={onClose}
              className="w-full bg-[#141414] hover:bg-[#1E1E1E] border border-white/[0.07] text-[#A0A0A0] hover:text-[#F5F5F5] text-sm py-2.5 rounded transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider mb-3">
        {label}
      </h3>
      {children}
    </div>
  );
}
