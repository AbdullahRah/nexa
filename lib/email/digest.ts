import { Resend } from "resend";
import { prisma } from "@/lib/db/client";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function formatValue(min: number | null, max: number | null): string {
  const val = max ?? min;
  if (!val) return "Value not stated";
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}m`;
  if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}k`;
  return `£${val.toLocaleString("en-GB")}`;
}

export async function sendDigests(): Promise<{ sent: number; failed: number }> {
  if (!resend || !process.env.RESEND_FROM_EMAIL) {
    return { sent: 0, failed: 0 };
  }

  // Find users who have digests enabled and haven't received one recently
  const profiles = await prisma.userProfile.findMany({
    where: {
      digest_enabled: true,
      OR: [
        { last_digest_at: null },
        {
          last_digest_at: {
            lt: new Date(Date.now() - 20 * 60 * 60 * 1000), // At least 20 hours ago
          },
        },
      ],
    },
  });

  let sent = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      // Get top scored opportunities for this user
      const topMatches = await prisma.matchScore.findMany({
        where: {
          user_id: profile.id,
          overall_score: { gte: 0.5 },
          opportunity: {
            status: { in: ["live", "closing_soon"] },
          },
        },
        include: {
          opportunity: {
            include: { ai_extractions: true },
          },
        },
        orderBy: { overall_score: "desc" },
        take: 10,
      });

      if (topMatches.length === 0) continue;

      const oppRows = topMatches
        .map((m) => {
          const o = m.opportunity;
          const score = Math.round(Number(m.overall_score) * 100);
          const deadline = o.tender_deadline
            ? o.tender_deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : "No deadline";
          const value = formatValue(
            o.value_min ? Number(o.value_min) : null,
            o.value_max ? Number(o.value_max) : null
          );
          const ai = o.ai_extractions[0] ?? null;
          const summary = ai?.summary ?? "";
          const riskFlags = ai?.risk_flags ?? [];

          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.07);">
              <td style="padding: 16px 0;">
                <div style="font-weight: 500; color: #F5F5F5; margin-bottom: 4px;">${o.title ?? "Untitled"}</div>
                ${summary ? `<div style="color: #A0A0A0; font-size: 13px; margin-bottom: 8px;">${summary}</div>` : ""}
                <div style="color: #A0A0A0; font-size: 12px;">
                  ${o.buyer_name ?? "Unknown"} · ${value} · Deadline: ${deadline}
                  ${riskFlags.length > 0 ? ` · <span style="color: #f59e0b;">${riskFlags.join(", ")}</span>` : ""}
                </div>
              </td>
              <td style="padding: 16px 0; text-align: right; vertical-align: top;">
                <span style="background: ${score >= 70 ? "#2563EB" : "#374151"}; color: white; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-family: monospace;">${score}%</span>
              </td>
            </tr>`;
        })
        .join("");

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0A0A0A; color: #F5F5F5; padding: 32px;">
          <div style="margin-bottom: 24px;">
            <span style="font-weight: 600; font-size: 16px;">Nexa</span>
            <span style="color: #A0A0A0; font-size: 13px; margin-left: 12px;">Daily Digest</span>
          </div>
          <p style="color: #A0A0A0; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
            Here are your top ${topMatches.length} construction opportunities matched to your profile.
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            ${oppRows}
          </table>
          <div style="margin-top: 24px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: #2563EB; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-size: 14px;">View all opportunities</a>
          </div>
          <p style="color: #A0A0A0; font-size: 11px; margin-top: 32px; text-align: center;">
            Nexa — a Staqtech product · <a href="${process.env.NEXT_PUBLIC_APP_URL}/profile" style="color: #A0A0A0;">Manage preferences</a>
          </p>
        </div>`;

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: profile.email,
        subject: `${topMatches.length} new construction opportunities matched for you`,
        html,
      });

      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { last_digest_at: new Date() },
      });

      sent++;
    } catch (err) {
      console.error(`Digest failed for ${profile.email}:`, err);
      failed++;
    }
  }

  return { sent, failed };
}
