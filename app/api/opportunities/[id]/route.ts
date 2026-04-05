import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: params.id },
  });

  if (!opportunity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(opportunity);
}
