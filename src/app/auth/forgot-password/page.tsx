'use client';

import React, { useState } from 'react';
import { Mail, ShieldCheck, ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setSubmitted(true);
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[60%] rounded-full bg-teal-900/10 blur-[120px]" />

      <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="mb-6">
          <Link href="/auth/login" className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors inline-flex items-center space-x-2 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </Link>
        </div>

        {!submitted ? (
          <>
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-600/30">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Reset Password
              </h1>
              <p className="text-xs text-zinc-400 mt-2">
                Provide your administrator or staff email to receive a recovery link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Registered Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 focus:border-indigo-500 focus:outline-none text-xs transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs tracking-wider uppercase transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <Send className="w-3 h-3" />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center mb-4 mx-auto shadow-lg shadow-teal-600/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-zinc-100 mb-2">Check Your Email</h1>
            <p className="text-xs text-zinc-400 mb-6">
              A secure password reset link was dispatched to <span className="font-semibold text-zinc-200">{email}</span>. Please verify your inbox.
            </p>
            <Link
              href="/auth/login"
              className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-850 rounded-lg text-xs font-semibold"
            >
              Return to Login Screen
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
