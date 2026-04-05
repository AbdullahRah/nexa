"use client";

import { formatDistanceToNow, isPast, differenceInDays } from "date-fns";

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

const SOURCE_LABELS: Record<string, string> = {
  contracts_finder: "CF",
  find_a_tender: "FaT",
  pcs: "PCS",
};

function formatValue(min: number | null, max: number | null): string {
  const val = max ?? min;
  if (!val) return "Value not stated";
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}m`;
  if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}k`;
  return `£${val.toLocaleString("en-GB")}`;
}

function formatDeadline(deadline: string | null): { label: string; urgent: boolean } {
  if (!deadline) return { label: "No deadline", urgent: false };
  const d = new Date(deadline);
  if (isPast(d)) return { label: "Closed", urgent: false };
  const days = differenceInDays(d, new Date());
  const urgent = days <= 5;
  const label = days === 0 ? "Closes today" : `Closes in ${days} day${days === 1 ? "" : "s"}`;
  return { label, urgent };
}

interface Opportunity {
  id: string;
  title: string | null;
  buyer_name: string | null;
  buyer_type: string | null;
  value_min: number | null;
  value_max: number | null;
  currency: string;
  tender_deadline: string | null;
  location_text: string | null;
  cpv_primary: string | null;
  source_system: string;
  status: string;
  published_at: string | null;
}

interface Props {
  opportunity: Opportunity;
  onClick: () => void;
}

export default function OpportunityCard({ opportunity: o, onClick }: Props) {
  const deadline = formatDeadline(o.tender_deadline);
  const cpvLabel = o.cpv_primary ? (CPV_LABELS[o.cpv_primary] ?? o.cpv_primary) : null;
  const sourceLabel = SOURCE_LABELS[o.source_system] ?? o.source_system;

  const statusColors = {
    live: "text-blue-400 bg-blue-400/10",
    closing_soon: "text-amber-400 bg-amber-400/10",
    closed: "text-zinc-500 bg-zinc-500/10",
  };

  const statusLabel = {
    live: "Live",
    closing_soon: "Closing Soon",
    closed: "Closed",
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#141414] border border-white/[0.07] rounded-[6px] p-5 hover:border-white/[0.14] hover:bg-[#1A1A1A] transition-colors"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-sm font-medium text-[#F5F5F5] line-clamp-2 leading-snug flex-1">
          {o.title ?? "Untitled Notice"}
        </h3>
        <span
          className={`shrink-0 text-[11px] font-mono px-2 py-0.5 rounded ${
            statusColors[o.status as keyof typeof statusColors] ?? statusColors.live
          }`}
        >
          {statusLabel[o.status as keyof typeof statusLabel] ?? o.status}
        </span>
      </div>

      <p className="text-xs text-[#A0A0A0] mb-4 truncate">
        {o.buyer_name ?? "Unknown Buyer"}
        {o.buyer_type && (
          <span className="ml-2 text-[#A0A0A0]/60 border border-white/[0.07] px-1.5 py-0.5 rounded text-[10px]">
            {o.buyer_type}
          </span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-[#A0A0A0]">Value</span>
          <p className="font-mono text-[#F5F5F5] mt-0.5">
            {formatValue(o.value_min, o.value_max)}
          </p>
        </div>
        <div>
          <span className="text-[#A0A0A0]">Deadline</span>
          <p
            className={`font-mono mt-0.5 ${
              deadline.urgent ? "text-red-400" : "text-[#F5F5F5]"
            }`}
          >
            {deadline.label}
          </p>
        </div>
        {o.location_text && (
          <div>
            <span className="text-[#A0A0A0]">Location</span>
            <p className="text-[#F5F5F5] mt-0.5 truncate">{o.location_text}</p>
          </div>
        )}
        {cpvLabel && (
          <div>
            <span className="text-[#A0A0A0]">Category</span>
            <p className="text-[#F5F5F5] mt-0.5 truncate">{cpvLabel}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/[0.05]">
        <span className="text-[10px] font-mono text-[#A0A0A0] border border-white/[0.07] px-1.5 py-0.5 rounded">
          {sourceLabel}
        </span>
        {o.cpv_primary && (
          <span className="text-[10px] font-mono text-[#A0A0A0]">{o.cpv_primary}</span>
        )}
        <span className="ml-auto text-[10px] text-[#A0A0A0]/50">
          {o.published_at
            ? formatDistanceToNow(new Date(o.published_at), { addSuffix: true })
            : ""}
        </span>
      </div>
    </button>
  );
}
