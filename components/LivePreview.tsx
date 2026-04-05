import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { differenceInDays, isPast } from "date-fns";

async function getRecentOpportunities() {
  try {
    return await prisma.opportunity.findMany({
      where: { status: { in: ["live", "closing_soon"] } },
      orderBy: { published_at: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        buyer_name: true,
        value_max: true,
        value_min: true,
        tender_deadline: true,
        location_text: true,
        cpv_primary: true,
        source_system: true,
        status: true,
      },
    });
  } catch {
    return [];
  }
}

const CPV_LABELS: Record<string, string> = {
  "45000000": "Construction Work",
  "45100000": "Site Preparation",
  "45200000": "Civil Engineering",
  "45210000": "Building Construction",
  "45300000": "MEP",
  "45400000": "Fit-Out",
  "50000000": "Maintenance",
  "71000000": "Architecture & Engineering",
  "71200000": "Architectural Services",
  "71300000": "Engineering Services",
  "71500000": "Construction Services",
  "72224000": "PM Consultancy",
};

const SOURCE_LABELS: Record<string, string> = {
  contracts_finder: "CF",
  find_a_tender: "FaT",
  pcs: "PCS",
};

function formatValue(min: unknown, max: unknown): string {
  const val = (max as number) ?? (min as number);
  if (!val) return "Value not stated";
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}m`;
  if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}k`;
  return `£${Number(val).toLocaleString("en-GB")}`;
}

function deadlineLabel(deadline: Date | null): { text: string; urgent: boolean } {
  if (!deadline) return { text: "No deadline", urgent: false };
  if (isPast(deadline)) return { text: "Closed", urgent: false };
  const days = differenceInDays(deadline, new Date());
  return {
    text: days === 0 ? "Closes today" : `${days}d left`,
    urgent: days <= 5,
  };
}

export default async function LivePreview() {
  const opps = await getRecentOpportunities();

  if (opps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#A0A0A0] text-sm">No live opportunities yet — data will appear after first sync.</p>
        <p className="text-[#A0A0A0]/50 text-xs mt-2 font-mono">
          Trigger: <code className="bg-[#1A1A1A] px-1.5 py-0.5 rounded">/api/ingest</code>
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {opps.map((opp) => {
        const dl = deadlineLabel(opp.tender_deadline);
        return (
          <Link
            key={opp.id}
            href="/dashboard"
            className="block bg-[#141414] border border-white/[0.07] rounded-[6px] p-5 hover:border-white/[0.14] hover:bg-[#1A1A1A] transition-colors"
          >
            <h3 className="text-sm font-medium text-[#F5F5F5] line-clamp-2 leading-snug mb-2">
              {opp.title ?? "Untitled Notice"}
            </h3>
            <p className="text-xs text-[#A0A0A0] truncate mb-4">{opp.buyer_name ?? "Unknown Buyer"}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-mono text-[#F5F5F5]">
                  {formatValue(opp.value_min, opp.value_max)}
                </p>
                <p className={`text-xs font-mono mt-1 ${dl.urgent ? "text-red-400" : "text-[#A0A0A0]"}`}>
                  {dl.text}
                </p>
              </div>
              <div className="text-right">
                {opp.cpv_primary && (
                  <p className="text-[10px] text-[#A0A0A0]">
                    {CPV_LABELS[opp.cpv_primary] ?? opp.cpv_primary}
                  </p>
                )}
                <span className="text-[10px] font-mono text-[#A0A0A0]/60">
                  {SOURCE_LABELS[opp.source_system] ?? opp.source_system}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
