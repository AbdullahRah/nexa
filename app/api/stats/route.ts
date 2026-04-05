import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [totalNotices, valueAgg, sources] = await Promise.all([
      prisma.opportunity.count({ where: { status: { in: ["live", "closing_soon"] } } }),
      prisma.opportunity.aggregate({
        _sum: { value_max: true },
        where: { value_max: { not: null } },
      }),
      prisma.source.count({ where: { is_active: true } }),
    ]);

    const totalValue = valueAgg._sum.value_max
      ? Number(valueAgg._sum.value_max)
      : 0;

    return NextResponse.json({
      totalNotices,
      totalValue,
      sourcesConnected: sources,
    });
  } catch {
    return NextResponse.json({ totalNotices: 0, totalValue: 0, sourcesConnected: 1 });
  }
}
