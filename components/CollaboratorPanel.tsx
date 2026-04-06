"use client";

import { useEffect, useState, useCallback } from "react";

interface Collaborator {
  id: string;
  proposal_id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
  accepted: boolean;
  created_at: string;
  email: string;
  company: string | null;
}

interface OwnerInfo {
  user_id: string;
  email: string;
  company: string | null;
}

interface CollaboratorPanelProps {
  proposalId: string;
  isOwner: boolean;
}

export default function CollaboratorPanel({
  proposalId,
  isOwner,
}: CollaboratorPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/collaborators`
      );
      if (!res.ok) throw new Error("Failed to fetch collaborators");
      const data = await res.json();
      setOwner(data.owner);
      setCollaborators(data.collaborators);
    } catch {
      setError("Could not load collaborators");
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/collaborators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to invite");
      }

      setInviteEmail("");
      await fetchCollaborators();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to invite collaborator"
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(collaboratorId: string) {
    setError(null);
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/collaborators`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collaboratorId }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }

      await fetchCollaborators();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove collaborator"
      );
    }
  }

  const roleBadgeClasses: Record<string, string> = {
    owner: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    editor: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    viewer: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-[#0A0A0A] p-6">
        <p className="text-[#A0A0A0] text-sm">Loading collaborators...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0A0A0A] p-6">
      <h3 className="text-[#F5F5F5] font-semibold text-lg mb-4">
        Team Collaborators
      </h3>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Collaborator list */}
      <div className="space-y-2 mb-6">
        {/* Owner row */}
        {owner && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-sm font-medium">
                  {owner.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[#F5F5F5] text-sm truncate">
                  {owner.email}
                </p>
                {owner.company && (
                  <p className="text-[#A0A0A0] text-xs truncate">
                    {owner.company}
                  </p>
                )}
              </div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeClasses.owner}`}
            >
              Owner
            </span>
          </div>
        )}

        {/* Collaborator rows */}
        {collaborators.map((collab) => (
          <div
            key={collab.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center flex-shrink-0">
                <span className="text-[#A0A0A0] text-sm font-medium">
                  {collab.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[#F5F5F5] text-sm truncate">
                  {collab.email}
                </p>
                <div className="flex items-center gap-2">
                  {collab.company && (
                    <p className="text-[#A0A0A0] text-xs truncate">
                      {collab.company}
                    </p>
                  )}
                  {!collab.accepted && collab.invited_email && (
                    <span className="text-xs text-yellow-500">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  roleBadgeClasses[collab.role] || roleBadgeClasses.viewer
                }`}
              >
                {collab.role.charAt(0).toUpperCase() + collab.role.slice(1)}
              </span>
              {isOwner && (
                <button
                  onClick={() => handleRemove(collab.id)}
                  className="text-[#A0A0A0] hover:text-red-400 transition-colors p-1"
                  title="Remove collaborator"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}

        {collaborators.length === 0 && (
          <p className="text-[#A0A0A0] text-sm text-center py-3">
            No collaborators yet
          </p>
        )}
      </div>

      {/* Invite section */}
      {isOwner && (
        <div className="border-t border-white/[0.07] pt-4">
          <h4 className="text-[#F5F5F5] text-sm font-medium mb-3">
            Invite Collaborator
          </h4>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleInvite();
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.07] text-[#F5F5F5] placeholder-[#A0A0A0] text-sm focus:outline-none focus:border-white/20 transition-colors"
            />
            <div className="flex items-center gap-2">
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "editor" | "viewer")
                }
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.07] text-[#F5F5F5] text-sm focus:outline-none focus:border-white/20 transition-colors appearance-none cursor-pointer"
              >
                <option value="editor" className="bg-[#1a1a1a]">
                  Editor
                </option>
                <option value="viewer" className="bg-[#1a1a1a]">
                  Viewer
                </option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {inviting ? "Inviting..." : "Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
