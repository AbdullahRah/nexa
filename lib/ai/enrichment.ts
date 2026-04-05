import Groq from "groq-sdk";
import { prisma } from "@/lib/db/client";

const OPENROUTER_MODEL = "qwen/qwen3.6-plus:free";
const GROQ_MODEL = "llama-3.3-70b-versatile";

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

function buildUserPrompt(opp: OppInput): string {
  return `Notice title: ${opp.title ?? "N/A"}
Buyer: ${opp.buyer_name ?? "N/A"}
Description: ${(opp.description_raw ?? "N/A").slice(0, 2000)}
CPV: ${opp.cpv_primary ?? "N/A"}
Deadline: ${opp.tender_deadline?.toISOString() ?? "N/A"}
Value: ${opp.value_min ?? "N/A"}–${opp.value_max ?? "N/A"}`;
}

interface OppInput {
  id: string;
  title: string | null;
  buyer_name: string | null;
  description_raw: string | null;
  cpv_primary: string | null;
  tender_deadline: Date | null;
  value_min: unknown;
  value_max: unknown;
}

// Primary: OpenRouter (Qwen)
async function callOpenRouter(userPrompt: string): Promise<{ content: string; model: string } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    console.error(`OpenRouter ${res.status}: ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;
  return { content, model: OPENROUTER_MODEL };
}

// Fallback: Groq (Llama)
async function callGroq(userPrompt: string): Promise<{ content: string; model: string } | null> {
  if (!process.env.GROQ_API_KEY) return null;
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
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
  return { content, model: GROQ_MODEL };
}

async function enrichSingle(opp: OppInput): Promise<(EnrichmentResult & { model: string }) | null> {
  const userPrompt = buildUserPrompt(opp);

  try {
    // Try OpenRouter first, fall back to Groq
    let result = await callOpenRouter(userPrompt);
    if (!result) {
      console.log(`OpenRouter unavailable for ${opp.id}, falling back to Groq`);
      result = await callGroq(userPrompt);
    }
    if (!result) return null;

    // Strip markdown code fences if present
    const cleaned = result.content.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as EnrichmentResult;
    return { ...parsed, model: result.model };
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
          model: result.model,
        },
        create: {
          opportunity_id: opp.id,
          trade_class: result.trade_classification,
          risk_flags: result.risk_flags,
          summary: result.summary,
          model: result.model,
        },
      });

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
