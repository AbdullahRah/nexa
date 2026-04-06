import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { processDocument } from "@/lib/knowledge/processor";

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    await processDocument(documentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Process error:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
