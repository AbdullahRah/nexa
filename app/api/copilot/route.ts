import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";

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

    const { selectedText, instruction, fullProposalContext, useKnowledge } =
      await req.json();

    if (!selectedText || !instruction) {
      return NextResponse.json(
        { error: "selectedText and instruction are required" },
        { status: 400 }
      );
    }

    // Optionally retrieve knowledge chunks
    let knowledgeSection = "";
    if (useKnowledge) {
      try {
        const { retrieveRelevantChunks } = await import(
          "@/lib/knowledge/retriever"
        );
        const chunks = await retrieveRelevantChunks(
          user.id,
          `${selectedText} ${instruction}`,
          5
        );
        if (chunks && chunks.length > 0) {
          const chunkTexts = chunks.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => (typeof c === "string" ? c : c.content)
          );
          knowledgeSection = `\nCompany Knowledge:\n${chunkTexts.join("\n---\n")}`;
        }
      } catch {
        // Knowledge retriever not available yet — proceed without it
      }
    }

    const prompt = `You are an expert UK bid writer assistant. The user is editing a proposal and has selected text to modify. Modify ONLY the selected text according to their instruction, keeping it consistent with the rest of the proposal.

Full proposal (for context only):
${fullProposalContext ?? ""}

Selected text to modify:
${selectedText}

Instruction: ${instruction}
${knowledgeSection}

Return ONLY the revised text. No explanations, no markdown code blocks wrapping the response.`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      console.error("OpenRouter Error:", await res.text());
      return NextResponse.json(
        { error: "Failed to generate copilot response" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const revisedText = data.choices[0]?.message?.content;

    if (!revisedText) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ revisedText: revisedText.trim() });
  } catch (err) {
    console.error("Copilot error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
