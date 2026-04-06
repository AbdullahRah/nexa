"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import GoNoGoModal from "@/components/GoNoGoModal";

const CPV_LABELS: Record<string, string> = {
  "45000000": "Construction Work",
  "45100000": "Site Preparation",
  "45200000": "Civil Engineering",
  "45210000": "Building Construction",
  "45300000": "MEP / Building Installation",
  "45400000": "Fit-Out & Finishes",
  "50000000": "Repair & Maintenance",
  "71000000": "Architecture & Engineering",
  "71200000": "Architectural Services",
  "71300000": "Engineering Services",
  "71500000": "Construction-Related Services",
  "72224000": "PM Consultancy",
};

interface Document {
  id: string;
  title: string | null;
  url: string | null;
  mime_type: string | null;
}

interface FullOpportunity {
  id: string;
  title: string | null;
  description_raw: string | null;
  buyer_name: string | null;
  buyer_identifier: string | null;
  buyer_type: string | null;
  value_min: number | null;
  value_max: number | null;
  currency: string;
  tender_deadline: string | null;
  contract_start: string | null;
  contract_end: string | null;
  cpv_primary: string | null;
  cpv_additional: string[];
  location_text: string | null;
  documents: Document[] | null;
  source_url: string | null;
  source_system: string;
  status: string;
  notice_type: string | null;
}

interface Props {
  opportunityId: string | null;
  onClose: () => void;
}

function fmt(date: string | null): string {
  if (!date) return "—";
  try {
    return format(new Date(date), "d MMM yyyy");
  } catch {
    return "—";
  }
}

function fmtValue(min: number | null, max: number | null): string {
  if (!min && !max) return "Not stated";
  if (min && max && min !== max)
    return `£${min.toLocaleString("en-GB")} – £${max.toLocaleString("en-GB")}`;
  const val = max ?? min;
  return val ? `£${val.toLocaleString("en-GB")}` : "Not stated";
}

export default function OpportunityDrawer({ opportunityId, onClose }: Props) {
  const [opportunity, setOpportunity] = useState<FullOpportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);

  // Go/No-Go state
  const [goNoGoLoading, setGoNoGoLoading] = useState(false);
  const [goNoGoAnalysis, setGoNoGoAnalysis] = useState<{
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
  } | null>(null);
  const [goNoGoModalOpen, setGoNoGoModalOpen] = useState(false);

  // Compliance state
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceResult, setComplianceResult] = useState<{
    overall_compliance: string;
    compliance_score?: number;
    requirements_checked?: { requirement: string; status: string; evidence?: string; suggestion?: string }[];
    missing_sections?: string[];
    warnings?: string[];
  } | null>(null);

  async function handleGenerateProposal() {
    if (!opportunity?.id) return;
    setGeneratingProposal(true);
    setProposal(null);
    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setProposal(data.proposal);
      } else {
        alert("Error generating proposal");
      }
    } catch (err) {
      console.error(err);
      alert("Error generating proposal");
    } finally {
      setGeneratingProposal(false);
    }
  }

  async function handleGoNoGo() {
    if (!opportunity?.id) return;
    setGoNoGoLoading(true);
    setGoNoGoAnalysis(null);
    setGoNoGoModalOpen(true);
    try {
      const res = await fetch("/api/go-no-go", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setGoNoGoAnalysis(data.analysis);
      } else {
        alert("Error running Go/No-Go analysis");
        setGoNoGoModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error running Go/No-Go analysis");
      setGoNoGoModalOpen(false);
    } finally {
      setGoNoGoLoading(false);
    }
  }

  async function handleComplianceCheck() {
    if (!opportunity?.id || !proposal) return;
    setComplianceLoading(true);
    setComplianceResult(null);
    try {
      const res = await fetch("/api/compliance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity.id, proposalText: proposal }),
      });
      if (res.ok) {
        const data = await res.json();
        setComplianceResult(data);
      } else {
        alert("Error checking compliance");
      }
    } catch (err) {
      console.error(err);
      alert("Error checking compliance");
    } finally {
      setComplianceLoading(false);
    }
  }

  async function handleSaveAndEdit() {
    if (!opportunity?.id || !proposal) return;
    // Save draft first
    try {
      await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: opportunity.id, content: proposal }),
      });
      // Navigate to editor
      window.location.href = `/proposal/${opportunity.id}`;
    } catch (err) {
      console.error(err);
      alert("Error saving draft");
    }
  }

  useEffect(() => {
    if (!opportunityId) {
      setOpportunity(null);
      setProposal(null);
      setGoNoGoAnalysis(null);
      setComplianceResult(null);
      return;
    }
    setLoading(true);
    setProposal(null);
    setGoNoGoAnalysis(null);
    setComplianceResult(null);
    fetch(`/api/opportunities/${opportunityId}`)
      .then((r) => r.json())
      .then((data) => {
        setOpportunity(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [opportunityId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const open = !!opportunityId;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[600px] bg-[#141414] border-l border-white/[0.07] z-50 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <span className="text-xs text-[#A0A0A0] font-mono">Opportunity Detail</span>
          <button
            onClick={onClose}
            className="text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-6">
          {loading && (
            <div className="text-[#A0A0A0] text-sm">Loading...</div>
          )}

          {!loading && opportunity && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[#F5F5F5] text-base font-semibold leading-snug">
                  {opportunity.title ?? "Untitled Notice"}
                </h2>
                {opportunity.notice_type && (
                  <span className="inline-block mt-2 text-[10px] font-mono text-[#A0A0A0] border border-white/[0.07] px-2 py-0.5 rounded">
                    {opportunity.notice_type}
                  </span>
                )}
              </div>

              {/* Buyer */}
              <Section label="Buyer">
                <Row label="Name">{opportunity.buyer_name ?? "—"}</Row>
                {opportunity.buyer_identifier && (
                  <Row label="Identifier">
                    <span className="font-mono">{opportunity.buyer_identifier}</span>
                  </Row>
                )}
                {opportunity.buyer_type && (
                  <Row label="Type">{opportunity.buyer_type}</Row>
                )}
              </Section>

              {/* Commercial */}
              <Section label="Commercial">
                <Row label="Value">{fmtValue(opportunity.value_min, opportunity.value_max)}</Row>
                <Row label="Deadline">{fmt(opportunity.tender_deadline)}</Row>
                {opportunity.contract_start && (
                  <Row label="Contract Start">{fmt(opportunity.contract_start)}</Row>
                )}
                {opportunity.contract_end && (
                  <Row label="Contract End">{fmt(opportunity.contract_end)}</Row>
                )}
              </Section>

              {/* Location */}
              {opportunity.location_text && (
                <Section label="Location">
                  <Row label="Region">{opportunity.location_text}</Row>
                </Section>
              )}

              {/* CPV Codes */}
              {(opportunity.cpv_primary || opportunity.cpv_additional?.length > 0) && (
                <Section label="CPV Codes">
                  {opportunity.cpv_primary && (
                    <Row label="Primary">
                      <span className="font-mono">{opportunity.cpv_primary}</span>
                      {CPV_LABELS[opportunity.cpv_primary] && (
                        <span className="text-[#A0A0A0] ml-2">
                          — {CPV_LABELS[opportunity.cpv_primary]}
                        </span>
                      )}
                    </Row>
                  )}
                  {opportunity.cpv_additional?.map((code) => (
                    <Row key={code} label="Additional">
                      <span className="font-mono">{code}</span>
                      {CPV_LABELS[code] && (
                        <span className="text-[#A0A0A0] ml-2">— {CPV_LABELS[code]}</span>
                      )}
                    </Row>
                  ))}
                </Section>
              )}

              {/* Description */}
              {opportunity.description_raw && (
                <Section label="Description">
                  <p className="text-sm text-[#A0A0A0] leading-relaxed whitespace-pre-wrap">
                    {opportunity.description_raw}
                  </p>
                </Section>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-white/[0.07] space-y-3">
                {/* Go/No-Go Button */}
                <button
                  onClick={handleGoNoGo}
                  disabled={goNoGoLoading}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium py-3 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {goNoGoLoading ? "Analyzing requirements..." : "Go / No-Go Analysis"}
                </button>

                {/* Generate Proposal Button */}
                <button
                  onClick={handleGenerateProposal}
                  disabled={generatingProposal}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-3 rounded transition-colors flex items-center justify-center gap-2"
                >
                  {generatingProposal ? "Generating with Qwen AI..." : "Generate Bid Proposal (AI)"}
                </button>
              </div>

              {/* Proposal Output */}
              {proposal && (
                <div className="space-y-3">
                  <Section label="AI Generated Proposal">
                    <div className="bg-[#1A1A1A] border border-blue-500/20 rounded p-4">
                      <p className="text-sm text-[#F5F5F5] leading-relaxed whitespace-pre-wrap">
                        {proposal}
                      </p>
                    </div>
                  </Section>

                  {/* Post-proposal actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAndEdit}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded transition-colors"
                    >
                      Open in Editor
                    </button>
                    <button
                      onClick={handleComplianceCheck}
                      disabled={complianceLoading}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded transition-colors"
                    >
                      {complianceLoading ? "Checking..." : "Audit Compliance"}
                    </button>
                  </div>

                  {/* Compliance Results Inline */}
                  {complianceResult && (
                    <Section label="Compliance Audit">
                      <div className="bg-[#1A1A1A] border border-white/[0.07] rounded p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded ${
                              complianceResult.overall_compliance === "COMPLIANT"
                                ? "bg-green-500/20 text-green-400"
                                : complianceResult.overall_compliance === "PARTIALLY_COMPLIANT"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {complianceResult.overall_compliance}
                          </span>
                          {complianceResult.compliance_score !== undefined && (
                            <span className="text-sm text-[#A0A0A0]">
                              Score: {complianceResult.compliance_score}%
                            </span>
                          )}
                        </div>

                        {(complianceResult.requirements_checked ?? []).length > 0 && (
                          <div className="space-y-2">
                            {(complianceResult.requirements_checked ?? []).map(
                              (req, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  <span
                                    className={`mt-0.5 shrink-0 ${
                                      req.status === "MET"
                                        ? "text-green-400"
                                        : req.status === "PARTIALLY_MET"
                                        ? "text-amber-400"
                                        : req.status === "NOT_MET"
                                        ? "text-red-400"
                                        : "text-[#A0A0A0]"
                                    }`}
                                  >
                                    {req.status === "MET"
                                      ? "✓"
                                      : req.status === "NOT_MET"
                                      ? "✕"
                                      : "~"}
                                  </span>
                                  <div>
                                    <span className="text-[#F5F5F5]">
                                      {req.requirement}
                                    </span>
                                    {req.suggestion && (
                                      <p className="text-[#A0A0A0] mt-0.5">
                                        Fix: {req.suggestion}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {(complianceResult.missing_sections ?? []).length > 0 && (
                          <div>
                            <p className="text-xs text-amber-400 font-medium mb-1">
                              Missing Sections:
                            </p>
                            <ul className="text-xs text-[#A0A0A0] list-disc list-inside">
                              {(complianceResult.missing_sections ?? []).map(
                                (s: string, i: number) => (
                                  <li key={i}>{s}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}
                </div>
              )}

              {/* Documents */}
              {opportunity.documents && Array.isArray(opportunity.documents) && opportunity.documents.length > 0 && (
                <Section label="Documents">
                  <div className="space-y-2">
                    {opportunity.documents.map((doc: Document) =>
                      doc.url ? (
                        <a
                          key={doc.id}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <span className="text-[10px] font-mono border border-white/[0.07] px-1.5 py-0.5 rounded text-[#A0A0A0]">
                            {doc.mime_type ?? "DOC"}
                          </span>
                          {doc.title ?? doc.url}
                        </a>
                      ) : null
                    )}
                  </div>
                </Section>
              )}

              {/* Source link */}
              {opportunity.source_url && (
                <div className="pt-4 border-t border-white/[0.07]">
                  <a
                    href={opportunity.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View on{" "}
                    {opportunity.source_system === "contracts_finder"
                      ? "Contracts Finder"
                      : opportunity.source_system === "find_a_tender"
                      ? "Find a Tender"
                      : "Source"}
                    {" →"}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Go/No-Go Modal */}
      <GoNoGoModal
        isOpen={goNoGoModalOpen}
        onClose={() => setGoNoGoModalOpen(false)}
        analysis={goNoGoAnalysis}
        loading={goNoGoLoading}
        opportunityTitle={opportunity?.title ?? undefined}
      />
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider mb-3">
        {label}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-[#A0A0A0] min-w-[120px] shrink-0">{label}</span>
      <span className="text-[#F5F5F5]">{children}</span>
    </div>
  );
}
