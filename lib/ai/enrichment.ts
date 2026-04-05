import Groq from "groq-sdk";
import { prisma } from "@/lib/db/client";

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const SYSTEM_PROMPT = `You are a UK construction procurement analyst. Given a tender notice, extract:

1. trade_classification: one of [general_contractor, civils, mep, fit_out, roofing, architecture, engineering, pm_consultancy, maintenance, specialist, other]
2. risk_flags: array of applicable flags from [short_deadline, bond_required, framework_only, mandatory_accreditations, multi_lot_complexity, heavy_documentation, unclear_scope]
3. summary: 2-sentence plain English summary of what is being procured

Respond only in JSON. No preamble. Format:
{"trade_classification":"...","risk_flags":[...],"summary":"..."}`;

interface EnrichmentResult {
  trade_classification: string;
  risk_flags: string[];
  summary: string;
}

async function enrichSingle(opp: {
  id: string;
  title: string | null;
  buyer_name: string | null;
  description_raw: string | null;
  cpv_primary: string | null;
  tender_deadline: Date | null;
  value_min: unknown;
  value_max: unknown;
}): Promise<EnrichmentResult | null> {
  const userPrompt = `Notice title: ${opp.title ?? "N/A"}
Buyer: ${opp.buyer_name ?? "N/A"}
Description: ${(opp.description_raw ?? "N/A").slice(0, 2000)}
CPV: ${opp.cpv_primary ?? "N/A"}
Deadline: ${opp.tender_deadline?.toISOString() ?? "N/A"}
Value: ${opp.value_min ?? "N/A"}–${opp.value_max ?? "N/A"}`;

  const groq = getGroq();
  if (!groq) return null;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as EnrichmentResult;
    return parsed;
  } catch (err) {
    console.error(`Enrichment failed for ${opp.id}:`, err);
    return null;
  }
}

export async function enrichOpportunities(limit = 20): Promise<{
  enriched: number;
  failed: number;
}> {
  // Find opportunities without AI extractions
  const opportunities = await prisma.opportunity.findMany({
    where: {
      ai_extractions: { none: {} },
      status: { in: ["live", "closing_soon"] },
    },
    select: {
      id: true,
      title: true,
      buyer_name: true,
      description_raw: true,
      cpv_primary: true,
      tender_deadline: true,
      value_min: true,
      value_max: true,
    },
    take: limit,
    orderBy: { published_at: "desc" },
  });

  let enriched = 0;
  let failed = 0;

  for (const opp of opportunities) {
    const result = await enrichSingle(opp);

    if (result) {
      await prisma.aiExtraction.upsert({
        where: { opportunity_id: opp.id },
        update: {
          trade_class: result.trade_classification,
          risk_flags: result.risk_flags,
          summary: result.summary,
          model: "llama-3.3-70b-versatile",
        },
        create: {
          opportunity_id: opp.id,
          trade_class: result.trade_classification,
          risk_flags: result.risk_flags,
          summary: result.summary,
          model: "llama-3.3-70b-versatile",
        },
      });

      // Also update the opportunity's description_summary
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { description_summary: result.summary },
      });

      enriched++;
    } else {
      failed++;
    }

    // Rate limit: small delay between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  return { enriched, failed };
}
