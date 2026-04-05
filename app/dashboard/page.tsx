"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FilterSidebar from "@/components/FilterSidebar";
import OpportunityCard from "@/components/OpportunityCard";
import OpportunityDrawer from "@/components/OpportunityDrawer";
import Header from "@/components/Header";

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
  cpv_additional: string[];
  source_system: string;
  status: string;
  published_at: string | null;
  notice_type: string | null;
  ocid: string;
  description_summary: string | null;
  ai_extractions: {
    trade_class: string | null;
    risk_flags: string[];
    summary: string | null;
  } | null;
}

interface ApiResponse {
  opportunities: Opportunity[];
  total: number;
  page: number;
  pages: number;
}

interface Filters {
  q: string;
  cpv: string[];
  region: string[];
  valueBand: string[];
  status: string;
  source: string[];
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  q: "",
  cpv: [],
  region: [],
  valueBand: [],
  status: "live",
  source: [],
  sort: "newest",
};

function buildQueryString(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.cpv.length) params.set("cpv", filters.cpv.join(","));
  if (filters.region.length) params.set("region", filters.region.join(","));
  if (filters.source.length) params.set("source", filters.source.join(","));
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.sort) params.set("sort", filters.sort);
  params.set("page", String(page));
  params.set("limit", "24");

  // Parse value bands
  const minValues = filters.valueBand.map((b) => {
    const [min] = b.split("-");
    return parseInt(min);
  });
  const maxValues = filters.valueBand.map((b) => {
    const parts = b.split("-");
    return parts[1] ? parseInt(parts[1]) : Infinity;
  });

  if (minValues.length > 0) {
    params.set("value_min", String(Math.min(...minValues)));
  }
  if (maxValues.length > 0 && !maxValues.includes(Infinity)) {
    params.set("value_max", String(Math.max(...maxValues)));
  }

  return params.toString();
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    try {
      const qs = buildQueryString(f, p);
      const res = await fetch(`/api/opportunities?${qs}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchData(filters, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, fetchData]);

  useEffect(() => {
    fetchData(filters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col">
      {/* Top nav */}
      <Header
        isDashboard={true}
        dataCount={data?.total ?? undefined}
        sortValue={filters.sort}
        onSortChange={(val) => setFilters((f) => ({ ...f, sort: val }))}
        maxWidthClass="w-full"
      />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <FilterSidebar filters={filters} onChange={setFilters} />

        {/* Divider */}
        <div className="w-px bg-white/[0.07] shrink-0" />

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 bg-[#141414] border border-white/[0.07] rounded-[6px] animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading && data && data.opportunities.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-[#A0A0A0] text-sm">No opportunities match your filters.</p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}

          {!loading && data && data.opportunities.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.opportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onClick={() => setSelectedId(opp.id)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="text-xs text-[#A0A0A0] hover:text-[#F5F5F5] disabled:opacity-30 transition-colors px-3 py-2 border border-white/[0.07] rounded"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[#A0A0A0]">
                    Page {page} of {data.pages}
                  </span>
                  <button
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="text-xs text-[#A0A0A0] hover:text-[#F5F5F5] disabled:opacity-30 transition-colors px-3 py-2 border border-white/[0.07] rounded"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <OpportunityDrawer
        opportunityId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
