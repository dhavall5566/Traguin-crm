'use client';

import React, { Suspense } from 'react';
import CustomerPortalView from './CustomerPortalView';

export default function CustomerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading portal…
        </div>
      }
    >
      <CustomerPortalView />
    </Suspense>
  );
}
