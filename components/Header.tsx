"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";
import { type User } from "@supabase/supabase-js";
import Link from "next/link";

interface HeaderProps {
  dataCount?: number;
  onSortChange?: (val: string) => void;
  sortValue?: string;
  isDashboard?: boolean;
  maxWidthClass?: string;
}

export default function Header({ 
  dataCount, 
  onSortChange, 
  sortValue, 
  isDashboard = false, 
  maxWidthClass = "max-w-6xl w-full" 
}: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav className="border-b border-white/[0.07] px-6 py-4 shrink-0">
      <div className={`mx-auto flex items-center justify-between ${maxWidthClass}`}>
        <Link href="/" className="font-semibold text-[#F5F5F5] tracking-tight">
          Nexa
        </Link>
        <div className="flex items-center gap-4">
          {isDashboard && dataCount !== undefined && (
            <span className="text-xs text-[#A0A0A0]">
              {dataCount >= 0 ? `${dataCount.toLocaleString()} results` : "Loading..."}
            </span>
          )}
          {isDashboard && onSortChange && (
            <select
              value={sortValue}
              onChange={(e) => onSortChange(e.target.value)}
              className="bg-[#1A1A1A] border border-white/[0.07] rounded text-xs text-[#A0A0A0] px-3 py-1.5 focus:outline-none"
            >
              <option value="newest">Newest first</option>
              <option value="deadline">Deadline soonest</option>
              <option value="value">Value (high to low)</option>
            </select>
          )}

          {user && (
            <>
              <Link
                href="/knowledge"
                className="text-xs text-[#A0A0A0] hover:text-[#F5F5F5] border border-white/[0.07] px-3 py-1.5 rounded transition-colors"
              >
                Knowledge Base
              </Link>
              <Link
                href="/profile"
                className="text-xs text-[#A0A0A0] hover:text-[#F5F5F5] border border-white/[0.07] px-3 py-1.5 rounded transition-colors"
              >
                Profile
              </Link>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-xs text-[#A0A0A0] hidden sm:inline">{user.email}</span>
              <button
                onClick={async () => {
                  const supabase = createSupabaseBrowser();
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
                className="text-xs text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
