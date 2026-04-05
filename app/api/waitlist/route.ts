import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  let body: { email?: string; trade?: string; company?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, trade, company } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    await prisma.waitlist.upsert({
      where: { email },
      update: { trade: trade ?? null, company: company ?? null },
      create: { email, trade: trade ?? null, company: company ?? null },
    });
  } catch (err) {
    console.error("Waitlist insert failed:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  // Send welcome email via Resend
  if (resend && process.env.RESEND_FROM_EMAIL) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: "You're on the Nexa waitlist",
        html: `
          <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #0A0A0A; color: #F5F5F5; padding: 40px 32px; border-radius: 6px;">
            <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600;">You're on the list.</h2>
            <p style="color: #A0A0A0; line-height: 1.6; margin: 0 0 24px;">
              We're building Nexa — a procurement intelligence platform for UK construction.
              Every live tender from Contracts Finder, Find a Tender, and Public Contracts Scotland,
              filtered for your trade and region.
            </p>
            <p style="color: #A0A0A0; line-height: 1.6; margin: 0 0 24px;">
              We'll be in touch when your early access is ready.
            </p>
            <p style="color: #A0A0A0; font-size: 13px; margin: 0;">
              — Nexa, a <a href="https://staqtech.com" style="color: #2563EB; text-decoration: none;">Staqtech</a> product
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Resend failed:", err);
      // Don't fail the whole request for email errors
    }
  }

  return NextResponse.json({ ok: true });
}
