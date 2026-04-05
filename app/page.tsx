import { Suspense } from "react";
import Link from "next/link";
import WaitlistForm from "@/components/WaitlistForm";
import LivePreview from "@/components/LivePreview";
import flexStatsBar from "@/components/StatsBar"; // dummy
import StatsBar from "@/components/StatsBar";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      {/* Nav */}
      <Header maxWidthClass="max-w-6xl w-full" />

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[#F5F5F5] max-w-2xl mx-auto leading-tight">
          Every UK construction tender. One feed.
        </h1>
        <p className="mt-6 text-[#A0A0A0] text-lg max-w-xl mx-auto leading-relaxed">
          Stop checking three portals. Nexa pulls from Contracts Finder, Find a Tender, and Public
          Contracts Scotland — filtered for your trade, region, and value range.
        </p>
        <div className="mt-10 max-w-sm mx-auto">
          <WaitlistForm />
        </div>
      </section>

      {/* Stats bar */}
      <Suspense fallback={<StatsBarSkeleton />}>
        <StatsBar />
      </Suspense>

      {/* Live preview */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-mono text-[#A0A0A0] uppercase tracking-wider">
            Live opportunities
          </h2>
          <Link
            href="/dashboard"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all →
          </Link>
        </div>
        <Suspense fallback={<LivePreviewSkeleton />}>
          <LivePreview />
        </Suspense>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/[0.07]">
        <h2 className="text-sm font-mono text-[#A0A0A0] uppercase tracking-wider mb-10 text-center">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          {[
            {
              step: "01",
              title: "We index",
              body: "Nexa continuously ingests tender notices from all major UK procurement portals, updated every 30 minutes.",
            },
            {
              step: "02",
              title: "You filter",
              body: "Filter by trade, region, value band, and deadline. No irrelevant notices, no noise.",
            },
            {
              step: "03",
              title: "You bid",
              body: "Get the full notice, documents, and a direct link to the source — everything you need to decide and submit.",
            },
          ].map((item) => (
            <div key={item.step}>
              <span className="text-[10px] font-mono text-blue-500">{item.step}</span>
              <h3 className="text-[#F5F5F5] font-medium mt-2 mb-2">{item.title}</h3>
              <p className="text-sm text-[#A0A0A0] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist form */}
      <section
        id="waitlist"
        className="max-w-6xl mx-auto px-6 py-20 border-t border-white/[0.07] text-center"
      >
        <h2 className="text-2xl font-semibold text-[#F5F5F5] mb-2">Get early access</h2>
        <p className="text-[#A0A0A0] text-sm mb-8">
          Join the waitlist. We&apos;ll notify you when your seat is ready.
        </p>
        <WaitlistForm />
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] px-6 py-6 text-center">
        <p className="text-xs text-[#A0A0A0]">
          Nexa — a{" "}
          <a
            href="https://staqtech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors"
          >
            Staqtech
          </a>{" "}
          product
        </p>
      </footer>
    </div>
  );
}

function StatsBarSkeleton() {
  return (
    <div className="border-t border-b border-white/[0.07] py-8">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-3 gap-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="text-center">
            <div className="h-8 w-24 bg-[#1A1A1A] rounded animate-pulse mx-auto mb-2" />
            <div className="h-3 w-32 bg-[#1A1A1A] rounded animate-pulse mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LivePreviewSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-52 bg-[#141414] border border-white/[0.07] rounded-[6px] animate-pulse"
        />
      ))}
    </div>
  );
}
