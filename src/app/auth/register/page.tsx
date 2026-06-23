'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Compass, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl">
        <div className="mb-6 flex items-center space-x-2">
          <Link
            href="/auth/login"
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs text-zinc-400 font-medium">Back to Sign In</span>
        </div>

        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100">Agency registration</h1>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            Self-service agency signup is not available yet. New agencies are provisioned by a
            platform administrator using the backend bootstrap script.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-100 text-xs flex gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            If you already have credentials from your administrator, sign in on the login page.
            Contact your platform admin to request a new agency workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
