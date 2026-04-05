"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/auth/supabase-browser";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-[#F5F5F5] font-medium mb-2">Check your email</p>
          <p className="text-[#A0A0A0] text-sm">
            We sent a confirmation link to <strong className="text-[#F5F5F5]">{email}</strong>. Click it to activate your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center font-semibold text-[#F5F5F5] tracking-tight text-lg mb-8">
          Nexa
        </Link>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider block mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] px-4 py-3 focus:outline-none focus:border-blue-600/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[#A0A0A0] uppercase tracking-wider block mb-2">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/[0.07] rounded text-sm text-[#F5F5F5] px-4 py-3 focus:outline-none focus:border-blue-600/50"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-3 rounded transition-colors"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-[#A0A0A0] text-sm mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
