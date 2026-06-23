'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/crm/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(
          typeof body?.detail === 'string'
            ? body.detail
            : 'Invalid email or password.',
        );
        setLoading(false);
        return;
      }

      const next = searchParams.get('next');
      router.push(next && next.startsWith('/dashboard') ? next : '/dashboard');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="crm-login-page">
      <div className="crm-login-card">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/dashboard" className="crm-brand">
            Traguin Admin
          </Link>
          <h1 className="crm-login-title mt-6">Agency CRM</h1>
          <p className="crm-login-subtitle">Sign in to your travel agency workspace</p>
        </div>

        {error && (
          <div className="crm-alert-error mb-4 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="crm-login-email" className="crm-field-label">
              Email address
            </label>
            <input
              id="crm-login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              autoComplete="email"
              className="crm-input"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="crm-login-password" className="crm-field-label mb-0">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-[10px] text-primary hover:underline">
                Forgot?
              </Link>
            </div>
            <input
              id="crm-login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="crm-input"
            />
          </div>

          <button type="submit" disabled={loading} className="crm-btn-primary">
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex justify-between gap-2.5 border-t border-border pt-6">
          <Link
            href="/portal/customer"
            className="flex-1 rounded-lg border border-border bg-secondary/40 py-2 text-center text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Customer Portal
          </Link>
          <Link
            href="/portal/vendor"
            className="flex-1 rounded-lg border border-border bg-secondary/40 py-2 text-center text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Vendor Portal
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Agency provisioning is handled by your administrator.{' '}
          <Link href="/auth/register" className="font-medium text-primary hover:underline">
            Learn more
          </Link>
        </p>
      </div>
    </div>
  );
}
