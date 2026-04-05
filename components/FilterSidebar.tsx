"use client";

interface Filters {
  q: string;
  cpv: string[];
  region: string[];
  valueBand: string[];
  status: string;
  source: string[];
  sort: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const CPV_OPTIONS = [
  { value: "general_works", label: "General Works" },
  { value: "civil", label: "Civil Engineering" },
  { value: "fit_out", label: "Fit-Out" },
  { value: "mep", label: "MEP" },
  { value: "architecture_engineering", label: "Architecture & Engineering" },
  { value: "maintenance", label: "Maintenance" },
  { value: "pm_consultancy", label: "PM & Consultancy" },
];

const REGION_OPTIONS = [
  { value: "london", label: "London" },
  { value: "south_east", label: "South East" },
  { value: "south_west", label: "South West" },
  { value: "midlands", label: "Midlands" },
  { value: "north_west", label: "North West" },
  { value: "north_east", label: "North East" },
  { value: "yorkshire", label: "Yorkshire" },
  { value: "scotland", label: "Scotland" },
  { value: "wales", label: "Wales" },
  { value: "northern_ireland", label: "Northern Ireland" },
  { value: "national", label: "National" },
];

const VALUE_OPTIONS = [
  { value: "0-50000", label: "Under £50k" },
  { value: "50000-250000", label: "£50k – £250k" },
  { value: "250000-1000000", label: "£250k – £1m" },
  { value: "1000000-5000000", label: "£1m – £5m" },
  { value: "5000000-", label: "£5m+" },
];

const SOURCE_OPTIONS = [
  { value: "contracts_finder", label: "Contracts Finder" },
  { value: "find_a_tender", label: "Find a Tender" },
  { value: "pcs", label: "PCS" },
];

function MultiCheck({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(val: string) {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  }

  return (
    <div className="space-y-1.5">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div
            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
              selected.includes(opt.value)
                ? "bg-blue-600 border-blue-600"
                : "border-white/20 group-hover:border-white/40"
            }`}
            onClick={() => toggle(opt.value)}
          >
            {selected.includes(opt.value) && (
              <svg className="w-2 h-2 text-white" viewBox="0 0 8 8" fill="none">
                <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <span className="text-xs text-[#A0A0A0] group-hover:text-[#F5F5F5] transition-colors">
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider mb-3">
        {label}
      </h3>
      {children}
    </div>
  );
}

export default function FilterSidebar({ filters, onChange }: Props) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col gap-6 py-6 pl-6 pr-4">
      {/* Search */}
      <FilterSection label="Search">
        <input
          type="text"
          placeholder="Keywords..."
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-xs text-[#F5F5F5] placeholder-[#A0A0A0]/50 px-3 py-2 focus:outline-none focus:border-blue-600/50"
        />
      </FilterSection>

      {/* Status */}
      <FilterSection label="Status">
        <div className="flex gap-2">
          {["live", "all"].map((s) => (
            <button
              key={s}
              onClick={() => set("status", s)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                filters.status === s
                  ? "border-blue-600 text-blue-400 bg-blue-600/10"
                  : "border-white/[0.07] text-[#A0A0A0] hover:border-white/20"
              }`}
            >
              {s === "live" ? "Live only" : "All"}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Trade / CPV */}
      <FilterSection label="Trade">
        <MultiCheck
          options={CPV_OPTIONS}
          selected={filters.cpv}
          onChange={(v) => set("cpv", v)}
        />
      </FilterSection>

      {/* Region */}
      <FilterSection label="Region">
        <MultiCheck
          options={REGION_OPTIONS}
          selected={filters.region}
          onChange={(v) => set("region", v)}
        />
      </FilterSection>

      {/* Value */}
      <FilterSection label="Value">
        <MultiCheck
          options={VALUE_OPTIONS}
          selected={filters.valueBand}
          onChange={(v) => set("valueBand", v)}
        />
      </FilterSection>

      {/* Source */}
      <FilterSection label="Source">
        <MultiCheck
          options={SOURCE_OPTIONS}
          selected={filters.source}
          onChange={(v) => set("source", v)}
        />
      </FilterSection>

      {/* Reset */}
      {(filters.q ||
        filters.cpv.length ||
        filters.region.length ||
        filters.valueBand.length ||
        filters.source.length ||
        filters.status !== "live") && (
        <button
          onClick={() =>
            onChange({
              q: "",
              cpv: [],
              region: [],
              valueBand: [],
              status: "live",
              source: [],
              sort: filters.sort,
            })
          }
          className="text-xs text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors text-left"
        >
          Clear all filters
        </button>
      )}
    </aside>
  );
}
