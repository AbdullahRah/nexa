import { NextRequest, NextResponse } from "next/server";
import { runContractsFinderSync } from "@/lib/ingestion/contracts-finder";

export async function GET(request: NextRequest) {
  // Protect with cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runContractsFinderSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Ingest failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
