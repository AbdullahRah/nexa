import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { scoreOpportunitiesForUser } from "@/lib/scoring/fit-score";

export async function GET() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { user_id: user.id },
  });

  if (!profile) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { trade, company, regions, value_min, value_max, target_cpvs, digest_frequency, digest_enabled } = body;

  const profile = await prisma.userProfile.upsert({
    where: { user_id: user.id },
    update: {
      trade: trade ?? undefined,
      company: company ?? undefined,
      regions: regions ?? undefined,
      value_min: value_min ?? undefined,
      value_max: value_max ?? undefined,
      target_cpvs: target_cpvs ?? undefined,
      digest_frequency: digest_frequency ?? undefined,
      digest_enabled: digest_enabled ?? undefined,
      updated_at: new Date(),
    },
    create: {
      user_id: user.id,
      email: user.email!,
      trade: trade ?? null,
      company: company ?? null,
      regions: regions ?? [],
      value_min: value_min ?? null,
      value_max: value_max ?? null,
      target_cpvs: target_cpvs ?? [],
      digest_frequency: digest_frequency ?? "daily",
      digest_enabled: digest_enabled ?? true,
    },
  });

  // Score opportunities in background
  scoreOpportunitiesForUser(profile.id).catch(console.error);

  return NextResponse.json({ profile });
}
