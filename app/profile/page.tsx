"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";
import Link from "next/link";
import Header from "@/components/Header";

const TRADE_OPTIONS = [
  { value: "", label: "Select trade" },
  { value: "general_contractor", label: "General Contractor" },
  { value: "civils", label: "Civil Engineering" },
  { value: "mep", label: "MEP / Building Services" },
  { value: "fit_out", label: "Fit-Out & Finishes" },
  { value: "architecture", label: "Architecture" },
  { value: "engineering", label: "Engineering" },
  { value: "pm_consultancy", label: "PM & Consultancy" },
  { value: "maintenance", label: "Maintenance" },
  { value: "specialist", label: "Specialist" },
];

const REGION_OPTIONS = [
  "London", "South East", "South West", "Midlands",
  "North West", "North East", "Yorkshire",
  "Wales", "Northern Ireland", "National",
];

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [trade, setTrade] = useState("");
  const [company, setCompany] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestFrequency, setDigestFrequency] = useState("daily");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      setUser({ email: user.email! });

      const res = await fetch("/api/profile");
      const data = await res.json();

      if (data.profile) {
        setTrade(data.profile.trade ?? "");
        setCompany(data.profile.company ?? "");
        setRegions(data.profile.regions ?? []);
        setValueMin(data.profile.value_min ?? "");
        setValueMax(data.profile.value_max ?? "");
        setDigestEnabled(data.profile.digest_enabled ?? true);
        setDigestFrequency(data.profile.digest_frequency ?? "daily");
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trade: trade || null,
        company: company || null,
        regions,
        value_min: valueMin ? Number(valueMin) : null,
        value_max: valueMax ? Number(valueMax) : null,
        digest_enabled: digestEnabled,
        digest_frequency: digestFrequency,
      }),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function toggleRegion(r: string) {
    setRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="text-[#A0A0A0] text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Header maxWidthClass="max-w-3xl w-full" />

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold text-[#F5F5F5] mb-8">Profile & Preferences</h1>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Trade & Company */}
          <Section label="Your Business">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#A0A0A0] block mb-2">Trade</label>
                <select
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] px-4 py-3 focus:outline-none focus:border-blue-600/50"
                >
                  {TRADE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#A0A0A0] block mb-2">Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] px-4 py-3 focus:outline-none focus:border-blue-600/50"
                />
              </div>
            </div>
          </Section>

          {/* Regions */}
          <Section label="Target Regions">
            <div className="flex flex-wrap gap-2">
              {REGION_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r.toLowerCase())}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    regions.includes(r.toLowerCase())
                      ? "border-blue-600 text-blue-400 bg-blue-600/10"
                      : "border-white/[0.07] text-[#A0A0A0] hover:border-white/20"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </Section>

          {/* Value Range */}
          <Section label="Value Range">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#A0A0A0] block mb-2">Min (£)</label>
                <input
                  type="number"
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] font-mono px-4 py-3 focus:outline-none focus:border-blue-600/50"
                />
              </div>
              <div>
                <label className="text-xs text-[#A0A0A0] block mb-2">Max (£)</label>
                <input
                  type="number"
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
                  placeholder="No limit"
                  className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] font-mono px-4 py-3 focus:outline-none focus:border-blue-600/50"
                />
              </div>
            </div>
          </Section>

          {/* Email Digest */}
          <Section label="Email Digest">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setDigestEnabled(!digestEnabled)}
                  className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${
                    digestEnabled ? "bg-blue-600" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      digestEnabled ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </div>
                <span className="text-sm text-[#A0A0A0]">
                  {digestEnabled ? "Enabled" : "Disabled"}
                </span>
              </label>

              {digestEnabled && (
                <select
                  value={digestFrequency}
                  onChange={(e) => setDigestFrequency(e.target.value)}
                  className="bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#A0A0A0] px-3 py-1.5 focus:outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              )}
            </div>
          </Section>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-6 py-3 rounded transition-colors"
            >
              {saving ? "Saving..." : "Save preferences"}
            </button>
            {saved && (
              <span className="text-sm text-green-400">Saved. Fit scores are being recalculated.</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider mb-4">{label}</h2>
      {children}
    </div>
  );
}
