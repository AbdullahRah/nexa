"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

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

  useEffect(() => {
    if (!opportunityId) {
      setOpportunity(null);
      return;
    }
    setLoading(true);
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
