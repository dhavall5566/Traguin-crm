'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { traguinLogo } from '@/lib/brand/traguin-logo';

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
    <div className="crm-login-card">
      <div className="crm-login-brand">
        <Image
          src={traguinLogo}
          alt="TRAGUIN"
          className="crm-login-brand__logo"
          priority
        />
      </div>

      <div className="crm-login-intro">
        <p className="crm-login-eyebrow">Agency CRM</p>
        <h1 className="crm-login-title">Sign in</h1>
        <p className="crm-login-subtitle">Sign in to your travel agency workspace.</p>
      </div>

      {error && <div className="crm-login-alert crm-login-alert--error">{error}</div>}

      <form onSubmit={handleLogin} className="crm-login-form">
        <div>
          <label htmlFor="crm-login-email" className="crm-login-label">
            Email
          </label>
          <input
            id="crm-login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="crm-login-input"
          />
        </div>
        <div>
          <label htmlFor="crm-login-password" className="crm-login-label">
            Password
          </label>
          <input
            id="crm-login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="crm-login-input"
          />
        </div>
        <button type="submit" disabled={loading} className="crm-login-submit">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
