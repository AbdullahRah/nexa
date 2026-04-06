import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/db/client";

async function getAuthenticatedUser() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function isOwner(proposalId: string, userId: string): Promise<boolean> {
  const proposal = await prisma.proposalDraft.findUnique({
    where: { id: proposalId },
    select: { user_id: true },
  });
  return proposal?.user_id === userId;
}

async function isCollaboratorOrOwner(
  proposalId: string,
  userId: string
): Promise<boolean> {
  const proposal = await prisma.proposalDraft.findUnique({
    where: { id: proposalId },
    select: { user_id: true },
  });

  if (proposal?.user_id === userId) return true;

  const collaborator = await prisma.proposalCollaborator.findFirst({
    where: { proposal_id: proposalId, user_id: userId },
  });

  return !!collaborator;
}

// GET - List collaborators
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proposalId = params.id;

  const hasAccess = await isCollaboratorOrOwner(proposalId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get the proposal owner info
  const proposal = await prisma.proposalDraft.findUnique({
    where: { id: proposalId },
    select: { user_id: true },
  });

  const collaborators = await prisma.proposalCollaborator.findMany({
    where: { proposal_id: proposalId },
    orderBy: { created_at: "asc" },
  });

  // Gather user IDs to look up profiles
  const userIds = collaborators
    .map((c) => c.user_id)
    .filter((uid) => uid !== "00000000-0000-0000-0000-000000000000");

  if (proposal?.user_id) {
    userIds.push(proposal.user_id);
  }

  const profiles = await prisma.userProfile.findMany({
    where: { user_id: { in: [...new Set(userIds)] } },
    select: { user_id: true, email: true, company: true },
  });

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

  const ownerProfile = proposal
    ? profileMap.get(proposal.user_id)
    : null;

  const enriched = collaborators.map((c) => {
    const profile = profileMap.get(c.user_id);
    return {
      ...c,
      email: c.invited_email || profile?.email || "Unknown",
      company: profile?.company || null,
    };
  });

  return NextResponse.json({
    owner: ownerProfile
      ? { user_id: proposal!.user_id, email: ownerProfile.email, company: ownerProfile.company }
      : { user_id: proposal?.user_id, email: "Unknown", company: null },
    collaborators: enriched,
  });
}

// POST - Add collaborator
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proposalId = params.id;

  const ownerCheck = await isOwner(proposalId, user.id);
  if (!ownerCheck) {
    return NextResponse.json(
      { error: "Only the owner can add collaborators" },
      { status: 403 }
    );
  }

  const { email, role } = await request.json();

  if (!email || !role) {
    return NextResponse.json(
      { error: "email and role are required" },
      { status: 400 }
    );
  }

  if (!["editor", "viewer"].includes(role)) {
    return NextResponse.json(
      { error: "role must be editor or viewer" },
      { status: 400 }
    );
  }

  // Look up user by email
  const profile = await prisma.userProfile.findFirst({
    where: { email: email.toLowerCase() },
  });

  const placeholderUserId = "00000000-0000-0000-0000-000000000000";

  const collaborator = await prisma.proposalCollaborator.create({
    data: {
      proposal_id: proposalId,
      user_id: profile?.user_id || placeholderUserId,
      role,
      invited_email: profile ? null : email.toLowerCase(),
      accepted: !!profile,
    },
  });

  return NextResponse.json(collaborator, { status: 201 });
}

// DELETE - Remove collaborator
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proposalId = params.id;

  const ownerCheck = await isOwner(proposalId, user.id);
  if (!ownerCheck) {
    return NextResponse.json(
      { error: "Only the owner can remove collaborators" },
      { status: 403 }
    );
  }

  const { collaboratorId } = await request.json();

  if (!collaboratorId) {
    return NextResponse.json(
      { error: "collaboratorId is required" },
      { status: 400 }
    );
  }

  // Verify the collaborator belongs to this proposal
  const collaborator = await prisma.proposalCollaborator.findFirst({
    where: { id: collaboratorId, proposal_id: proposalId },
  });

  if (!collaborator) {
    return NextResponse.json(
      { error: "Collaborator not found" },
      { status: 404 }
    );
  }

  await prisma.proposalCollaborator.delete({
    where: { id: collaboratorId },
  });

  return NextResponse.json({ success: true });
}
