import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

const CPV_FAMILY_MAP: Record<string, string[]> = {
  general_works: ["45000000", "45100000", "45200000", "45210000"],
  civil: ["45100000", "45200000"],
  fit_out: ["45400000"],
  mep: ["45300000"],
  architecture_engineering: ["71000000", "71200000", "71300000", "71500000"],
  maintenance: ["50000000"],
  pm_consultancy: ["72224000"],
};

const REGION_MAP: Record<string, string[]> = {
  london: ["london", "greater london", "city of london"],
  south_east: ["south east", "surrey", "kent", "essex", "berkshire", "hampshire"],
  south_west: ["south west", "bristol", "devon", "cornwall", "somerset"],
  midlands: ["midlands", "west midlands", "east midlands", "birmingham", "coventry"],
  north_west: ["north west", "manchester", "liverpool", "cheshire", "lancashire"],
  north_east: ["north east", "newcastle", "sunderland", "durham"],
  yorkshire: ["yorkshire", "leeds", "sheffield", "bradford"],
  scotland: ["scotland"],
  wales: ["wales"],
  northern_ireland: ["northern ireland"],
  national: [],
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const q = searchParams.get("q") ?? "";
  const cpv = searchParams.get("cpv") ?? "";
  const region = searchParams.get("region") ?? "";
  const valueMin = searchParams.get("value_min");
  const valueMax = searchParams.get("value_max");
  const status = searchParams.get("status") ?? "";
  const source = searchParams.get("source") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "24")));

  const where: Prisma.OpportunityWhereInput = {};

  // Keyword search
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description_raw: { contains: q, mode: "insensitive" } },
    ];
  }

  // CPV family filter
  if (cpv) {
    const families = cpv.split(",").filter(Boolean);
    const codes: string[] = [];
    for (const f of families) {
      codes.push(...(CPV_FAMILY_MAP[f] ?? [f]));
    }
    if (codes.length > 0) {
      where.cpv_primary = { in: codes };
    }
  }

  // Region filter (text-based match on location_text or region_code)
  if (region) {
    const regions = region.split(",").filter(Boolean);
    const terms: string[] = [];
    for (const r of regions) {
      terms.push(...(REGION_MAP[r] ?? [r]));
    }
    if (terms.length > 0) {
      const regionOr = terms.map((t) => ({
        location_text: { contains: t, mode: "insensitive" as const },
      }));
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: regionOr }];
        delete where.OR;
      } else {
        where.OR = regionOr;
      }
    }
  }

  // Value filters
  if (valueMin) {
    where.value_max = { gte: new Prisma.Decimal(valueMin) };
  }
  if (valueMax) {
    where.value_min = { lte: new Prisma.Decimal(valueMax) };
  }

  // Status filter
  if (status && status !== "all") {
    where.status = status;
  }

  // Source filter
  if (source) {
    const sources = source.split(",").filter(Boolean);
    if (sources.length > 0) {
      where.source_system = { in: sources };
    }
  }

  // Sort
  let orderBy: Prisma.OpportunityOrderByWithRelationInput = { published_at: "desc" };
  if (sort === "deadline") orderBy = { tender_deadline: "asc" };
  if (sort === "value") orderBy = { value_max: "desc" };

  const [total, opportunities] = await Promise.all([
    prisma.opportunity.count({ where }),
    prisma.opportunity.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        buyer_name: true,
        buyer_type: true,
        value_min: true,
        value_max: true,
        currency: true,
        tender_deadline: true,
        location_text: true,
        region_code: true,
        cpv_primary: true,
        cpv_additional: true,
        source_system: true,
        status: true,
        published_at: true,
        notice_type: true,
        ocid: true,
        description_summary: true,
        ai_extractions: {
          select: {
            trade_class: true,
            risk_flags: true,
            summary: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    opportunities,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
