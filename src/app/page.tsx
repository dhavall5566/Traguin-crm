'use client';

import React from 'react';
import Link from 'next/link';
import { Compass, Users, Map, DollarSign, Shield, ArrowRight, CheckCircle } from 'lucide-react';

const features = [
  { name: 'Multi-Tenant SaaS CRM', desc: 'Secure data isolation (Supabase RLS) for travel agencies, leads, branding, and permissions.', icon: Users },
  { name: 'Advanced Itinerary Planner', desc: 'Construct day-wise flight/hotel blocks with dynamic markups, taxes, and instant PDF download.', icon: Map },
  { name: 'Integrated Financial Ledger', desc: 'Track vendor accounts, outstanding invoice payments, customer billing, and gross profits.', icon: DollarSign },
  { name: 'Role-Based Access Control', desc: 'Granular view/edit modules for sales agents, operators, and finance managers.', icon: Shield },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden flex flex-col justify-between">
      {/* Background radial effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[130px] z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/10 blur-[130px] z-0" />

      {/* Top Header */}
      <header className="relative z-10 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-sm uppercase">AeroERP</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <Link href="/auth/login" className="px-3.5 py-1.5 rounded hover:bg-white/5 transition-colors font-medium">
            Sign In
          </Link>
          <Link href="/auth/register" className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold transition-colors">
            Register Agency
          </Link>
        </div>
      </header>

      {/* Hero Content */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col lg:flex-row items-center justify-between gap-12 flex-1">
        <div className="flex-1 space-y-6 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-950/50 border border-indigo-900/50 text-[10px] text-indigo-300 font-medium">
            <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Next.js 15 & Supabase Powered SaaS</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-slate-100 via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            The Ultimate Travel CRM + ERP Workspace.
          </h1>
          
          <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
            Unify lead pipelines, drag-and-drop itinerary builders, invoice tracking, vendor ledgers, and portal logins in a secure, multi-tenant SaaS environment.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 text-xs font-semibold">
            <Link 
              href="/auth/login" 
              className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-all text-white shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2"
            >
              <span>Launch Agency CRM</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link 
              href="/portal/customer" 
              className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all text-zinc-200 border border-zinc-700/40 flex items-center justify-center space-x-2"
            >
              <span>View Customer Portal</span>
            </Link>
            <Link 
              href="/portal/vendor" 
              className="px-6 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all text-teal-400 border border-zinc-700/40 flex items-center justify-center space-x-2"
            >
              <span>View Vendor Portal</span>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div 
                key={i} 
                className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all hover:bg-zinc-900/80 flex flex-col justify-between"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-900/50 flex items-center justify-center text-indigo-400 mb-4">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{f.name}</h3>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-900 bg-slate-950/80 py-6 px-6 text-center text-[10px] text-zinc-500">
        <p>© 2026 AeroERP Technologies, Inc. Enterprise-Grade Architecture. All rights reserved.</p>
      </footer>
    </div>
  );
}
