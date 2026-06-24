'use client';

import React, { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div className="crm-login-page">
      <Suspense fallback={<p className="crm-login-loading">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
