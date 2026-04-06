import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const opportunityId = req.nextUrl.searchParams.get("opportunityId");

    if (!opportunityId) {
      return NextResponse.json(
        { error: "opportunityId query param is required" },
        { status: 400 }
      );
    }

    const draft = await prisma.proposalDraft.findFirst({
      where: {
        user_id: user.id,
        opportunity_id: opportunityId,
        is_latest: true,
      },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("GET /api/proposals error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { opportunityId, content } = await req.json();

    if (!opportunityId || content === undefined) {
      return NextResponse.json(
        { error: "opportunityId and content are required" },
        { status: 400 }
      );
    }

    // Find existing latest draft
    const existingDraft = await prisma.proposalDraft.findFirst({
      where: {
        user_id: user.id,
        opportunity_id: opportunityId,
        is_latest: true,
      },
      orderBy: { version: "desc" },
    });

    let draft;

    if (existingDraft) {
      // Mark old draft as not latest, then create new version
      await prisma.proposalDraft.update({
        where: { id: existingDraft.id },
        data: { is_latest: false },
      });

      draft = await prisma.proposalDraft.create({
        data: {
          user_id: user.id,
          opportunity_id: opportunityId,
          content,
          version: existingDraft.version + 1,
          is_latest: true,
        },
      });
    } else {
      draft = await prisma.proposalDraft.create({
        data: {
          user_id: user.id,
          opportunity_id: opportunityId,
          content,
          version: 1,
          is_latest: true,
        },
      });
    }

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("POST /api/proposals error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
