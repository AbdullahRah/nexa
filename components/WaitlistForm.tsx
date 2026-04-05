"use client";

import { useState } from "react";

const TRADE_OPTIONS = [
  { value: "", label: "Select trade (optional)" },
  { value: "general_contractor", label: "General Contractor" },
  { value: "mep", label: "MEP / Building Services" },
  { value: "consultant", label: "Consultant" },
  { value: "specialist", label: "Specialist Subcontractor" },
  { value: "other", label: "Other" },
];

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [trade, setTrade] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, trade: trade || undefined, company: company || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong");
      }

      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (state === "success") {
    return (
      <div className="text-center py-4">
        <p className="text-[#F5F5F5] font-medium">You&apos;re on the list.</p>
        <p className="text-[#A0A0A0] text-sm mt-1">We&apos;ll be in touch when early access opens.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 w-full max-w-md mx-auto">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] placeholder-[#A0A0A0]/50 px-4 py-3 focus:outline-none focus:border-blue-600/50"
      />
      <div className="grid grid-cols-2 gap-3">
        <select
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          className="bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#A0A0A0] px-4 py-3 focus:outline-none focus:border-blue-600/50"
        >
          {TRADE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Company (optional)"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] placeholder-[#A0A0A0]/50 px-4 py-3 focus:outline-none focus:border-blue-600/50"
        />
      </div>
      {errorMsg && (
        <p className="text-red-400 text-sm">{errorMsg}</p>
      )}
      <button
        type="submit"
        disabled={state === "loading"}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-3 rounded transition-colors"
      >
        {state === "loading" ? "Joining..." : "Get early access"}
      </button>
    </form>
  );
}
