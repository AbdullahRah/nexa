import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/client";

const OPENROUTER_MODEL = "qwen/qwen-2.5-72b-instruct";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { opportunityId, proposalText } = await req.json();

    if (!opportunityId || !proposalText) {
      return NextResponse.json(
        { error: "opportunityId and proposalText are required" },
        { status: 400 }
      );
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    // Optionally fetch GoNoGoAnalysis for additional context
    const goNoGo = await prisma.goNoGoAnalysis.findUnique({
      where: {
        opportunity_id_user_id: {
          opportunity_id: opportunityId,
          user_id: user.id,
        },
      },
    });

    let requirementsContext = "";
    if (goNoGo) {
      requirementsContext = `\nPreviously extracted requirements: ${JSON.stringify(goNoGo.analysis)}`;
    }

    const prompt = `You are a UK procurement compliance auditor. Compare this draft proposal against the original tender requirements and identify compliance gaps.

ORIGINAL TENDER REQUIREMENTS:
${opportunity.description_raw ?? "No description available."}
${requirementsContext}

DRAFT PROPOSAL:
${proposalText}

For each requirement in the tender, assess whether the proposal adequately addresses it.

Return valid JSON only (no markdown, no code blocks):
{"overall_compliance":"COMPLIANT"|"PARTIALLY_COMPLIANT"|"NON_COMPLIANT","compliance_score":85,"requirements_checked":[{"requirement":"...","status":"MET"|"PARTIALLY_MET"|"NOT_MET"|"NOT_APPLICABLE","evidence":"...","suggestion":"..."}],"missing_sections":["..."],"warnings":["..."]}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error("OpenRouter Error:", await res.text());
      return NextResponse.json(
        { error: "Failed to run compliance check" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const rawContent = data.choices[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Strip markdown code blocks if present
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse compliance JSON:", cleaned);
      return NextResponse.json(
        { error: "Failed to parse compliance results" },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Compliance check error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
