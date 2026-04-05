import { NextRequest, NextResponse } from "next/server";
import { sendDigests } from "@/lib/email/digest";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Digest failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
