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

    const { opportunityId } = await req.json();

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required" },
        { status: 400 }
      );
    }

    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opp) {
      return NextResponse.json(
        { error: "Opportunity not found" },
        { status: 404 }
      );
    }

    const prompt = `You are a UK procurement compliance expert. Analyze this tender notice and provide a Go/No-Go decision summary.

Extract and organize:
1. MANDATORY REQUIREMENTS - Every must-have qualification, certification, or requirement
2. KEY DEADLINES - All critical dates
3. FINANCIAL THRESHOLDS - Required turnover, bonds, pricing format
4. EXPERIENCE REQUIREMENTS - Minimum years, similar projects, references
5. GEOGRAPHICAL CONSTRAINTS - Location requirements, regional restrictions
6. RED FLAGS - Tight timelines, onerous T&Cs, unclear scope
7. GO/NO-GO RECOMMENDATION with confidence level

Return valid JSON only (no markdown, no code blocks):
{"mandatory_requirements":[{"requirement":"...","critical":true}],"deadlines":[{"date":"...","description":"..."}],"financial_thresholds":[{"description":"...","value":"..."}],"experience_requirements":["..."],"geographical_constraints":["..."],"red_flags":["..."],"recommendation":"GO"|"NO-GO"|"CONDITIONAL","confidence":"HIGH"|"MEDIUM"|"LOW","reasoning":"...","time_to_submit":"X days"}

Tender:
Title: ${opp.title ?? "N/A"}
Buyer: ${opp.buyer_name ?? "N/A"}
Value: \u00a3${opp.value_min ?? "N/A"} - \u00a3${opp.value_max ?? "N/A"}
Deadline: ${opp.tender_deadline ? opp.tender_deadline.toISOString() : "N/A"}
Description:
${opp.description_raw ?? "No description provided."}`;

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
        { error: "Failed to generate analysis" },
        { status: 500 }
      );
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "Failed to extract analysis from AI response" },
        { status: 500 }
      );
    }

    // Strip markdown code blocks if present
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI JSON response:", content);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    // Upsert the analysis
    await prisma.goNoGoAnalysis.upsert({
      where: {
        opportunity_id_user_id: {
          opportunity_id: opportunityId,
          user_id: user.id,
        },
      },
      update: {
        recommendation: analysis.recommendation ?? "CONDITIONAL",
        confidence: analysis.confidence ?? "MEDIUM",
        analysis: analysis,
        created_at: new Date(),
      },
      create: {
        opportunity_id: opportunityId,
        user_id: user.id,
        recommendation: analysis.recommendation ?? "CONDITIONAL",
        confidence: analysis.confidence ?? "MEDIUM",
        analysis: analysis,
      },
    });

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("Go/No-Go endpoint error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
