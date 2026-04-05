import { NextRequest, NextResponse } from "next/server";
import { runContractsFinderSync } from "@/lib/ingestion/contracts-finder";
import { runFindATenderSync } from "@/lib/ingestion/find-a-tender";
import { enrichOpportunities } from "@/lib/ai/enrichment";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    results.contracts_finder = await runContractsFinderSync();
  } catch (err) {
    results.contracts_finder = { error: String(err) };
  }

  try {
    results.find_a_tender = await runFindATenderSync();
  } catch (err) {
    results.find_a_tender = { error: String(err) };
  }

  // Enrich a batch of unenriched opportunities
  try {
    results.enrichment = await enrichOpportunities(10);
  } catch (err) {
    results.enrichment = { error: String(err) };
  }

  return NextResponse.json({ ok: true, results });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
