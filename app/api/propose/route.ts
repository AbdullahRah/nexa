import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Utilizing Qwen via OpenRouter for the proposal generation
const OPENROUTER_MODEL = "qwen/qwen-2.5-72b-instruct"; 

export async function POST(req: Request) {
  try {
    const { opportunityId } = await req.json();

    if (!opportunityId) {
      return new NextResponse("Opportunity ID is required", { status: 400 });
    }

    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opp) return new NextResponse("Opportunity not found", { status: 404 });

    const prompt = `You are a highly skilled UK bid writer and procurement expert. Please write a highly persuasive, professional proposal draft for the following opportunity. The proposal should emphasize our expertise, highlight how we meet the buyer's needs, and provide a strong hook. Keep it concise, structured, and under 500 words. It should be formatted in Markdown.

Opportunity Details:
Title: ${opp.title ?? "N/A"}
Buyer: ${opp.buyer_name ?? "N/A"}
Value Range: £${opp.value_min ?? "N/A"} - £${opp.value_max ?? "N/A"}
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
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      console.error("OpenRouter Error:", await res.text());
      return new NextResponse("Failed to generate proposal", { status: 500 });
    }

    const data = await res.json();
    const proposal = data.choices[0]?.message?.content;

    if (!proposal) {
      return new NextResponse("Failed to extract proposal from AI response", { status: 500 });
    }

    return NextResponse.json({ proposal });
  } catch (err) {
    console.error("Propose endpoint error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
