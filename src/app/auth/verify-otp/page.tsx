'use client';

import React, { Suspense } from 'react';
import VerifyOtpForm from './VerifyOtpForm';

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <VerifyOtpForm />
    </Suspense>
  );
}
