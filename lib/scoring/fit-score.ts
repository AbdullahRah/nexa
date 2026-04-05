import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

// CPV prefix to trade mapping
const CPV_TRADE_MAP: Record<string, string[]> = {
  general_contractor: ["45000", "45100", "45200", "45210"],
  civils: ["45100", "45200"],
  mep: ["45300"],
  fit_out: ["45400"],
  architecture: ["71200"],
  engineering: ["71300", "71000"],
  pm_consultancy: ["72224", "71500"],
  maintenance: ["50000"],
};

function tradeScore(userTrade: string | null, oppCpv: string | null, aiTrade: string | null): number {
  if (!userTrade) return 0.5;

  // Direct AI trade match
  if (aiTrade && aiTrade === userTrade) return 1.0;
  if (aiTrade && aiTrade !== userTrade) return 0.2;

  // CPV prefix match
  if (oppCpv) {
    const tradePrefixes = CPV_TRADE_MAP[userTrade] ?? [];
    for (const prefix of tradePrefixes) {
      if (oppCpv.startsWith(prefix)) return 0.9;
    }
  }

  return 0.3;
}

function geoScore(userRegions: string[], oppLocation: string | null): number {
  if (userRegions.length === 0) return 0.5;
  if (!oppLocation) return 0.3;

  const loc = oppLocation.toLowerCase();
  for (const region of userRegions) {
    if (loc.includes(region.toLowerCase())) return 1.0;
  }

  // "national" matches everything
  if (userRegions.includes("national")) return 0.8;

  return 0.1;
}

function valueScore(
  userMin: number | null,
  userMax: number | null,
  oppMin: number | null,
  oppMax: number | null
): number {
  if (!userMin && !userMax) return 0.5;
  const oppVal = oppMax ?? oppMin;
  if (!oppVal) return 0.3;

  const uMin = userMin ?? 0;
  const uMax = userMax ?? Infinity;

  if (oppVal >= uMin && oppVal <= uMax) return 1.0;

  // Partially in range
  const distance = oppVal < uMin ? (uMin - oppVal) / uMin : (oppVal - uMax) / uMax;
  return Math.max(0, 1 - distance);
}

function timingScore(deadline: Date | null): number {
  if (!deadline) return 0.3;
  const now = new Date();
  const daysLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysLeft < 0) return 0; // Closed
  if (daysLeft <= 3) return 0.3; // Too tight
  if (daysLeft <= 14) return 1.0; // Sweet spot
  if (daysLeft <= 30) return 0.8;
  return 0.5; // Far out
}

export async function scoreOpportunitiesForUser(userId: string): Promise<number> {
  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
  });

  if (!profile) return 0;

  const opportunities = await prisma.opportunity.findMany({
    where: {
      status: { in: ["live", "closing_soon"] },
    },
    include: {
      ai_extractions: true,
    },
  });

  let scored = 0;

  for (const opp of opportunities) {
    const ai = opp.ai_extractions[0] ?? null;
    const ts = tradeScore(profile.trade, opp.cpv_primary, ai?.trade_class ?? null);
    const gs = geoScore(profile.regions, opp.location_text);
    const vs = valueScore(
      profile.value_min ? Number(profile.value_min) : null,
      profile.value_max ? Number(profile.value_max) : null,
      opp.value_min ? Number(opp.value_min) : null,
      opp.value_max ? Number(opp.value_max) : null
    );
    const tms = timingScore(opp.tender_deadline);
    const bs = 0.5; // Buyer score — neutral for now

    const overall = 0.35 * ts + 0.25 * gs + 0.20 * vs + 0.10 * bs + 0.10 * tms;

    await prisma.matchScore.upsert({
      where: {
        user_id_opportunity_id: {
          user_id: userId,
          opportunity_id: opp.id,
        },
      },
      update: {
        trade_score: new Prisma.Decimal(ts),
        geo_score: new Prisma.Decimal(gs),
        value_score: new Prisma.Decimal(vs),
        buyer_score: new Prisma.Decimal(bs),
        timing_score: new Prisma.Decimal(tms),
        overall_score: new Prisma.Decimal(overall),
      },
      create: {
        user_id: userId,
        opportunity_id: opp.id,
        trade_score: new Prisma.Decimal(ts),
        geo_score: new Prisma.Decimal(gs),
        value_score: new Prisma.Decimal(vs),
        buyer_score: new Prisma.Decimal(bs),
        timing_score: new Prisma.Decimal(tms),
        overall_score: new Prisma.Decimal(overall),
      },
    });

    scored++;
  }

  return scored;
}
