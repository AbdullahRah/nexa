import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/client";
import { generateWordDocument } from "@/lib/export/word";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { opportunityId, proposalContent } = await request.json();

  if (!opportunityId || !proposalContent) {
    return NextResponse.json(
      { error: "opportunityId and proposalContent are required" },
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

  const metadata = {
    title: opportunity.title || "Proposal",
    buyer: opportunity.buyer_name || "Unknown Buyer",
    deadline: opportunity.tender_deadline
      ? new Date(opportunity.tender_deadline).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "Not specified",
  };

  const buffer = await generateWordDocument(proposalContent, metadata);

  const sanitizedTitle = (opportunity.title || "Proposal")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  const headers = new Headers();
  headers.set(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename="Proposal - ${sanitizedTitle}.docx"`
  );

  return new NextResponse(new Uint8Array(buffer), { headers });
}
