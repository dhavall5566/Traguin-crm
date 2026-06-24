'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type CrmToastVariant = 'success' | 'error' | 'info';

type CrmToastItem = {
  id: string;
  message: string;
  variant: CrmToastVariant;
};

type ShowToastOptions = {
  message: string;
  variant?: CrmToastVariant;
  durationMs?: number;
};

type CrmToastContextValue = {
  showToast: (options: ShowToastOptions) => void;
};

const CrmToastContext = createContext<CrmToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 2800;

function ToastIcon({ variant }: { variant: CrmToastVariant }) {
  const className = 'crm-toast__icon';
  if (variant === 'error') return <AlertCircle className={className} aria-hidden />;
  if (variant === 'info') return <Info className={className} aria-hidden />;
  return <CheckCircle2 className={className} aria-hidden />;
}

export function CrmToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<CrmToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, variant = 'success', durationMs = DEFAULT_DURATION_MS }: ShowToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);
      const timer = setTimeout(() => dismiss(id), durationMs);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <CrmToastContext.Provider value={{ showToast }}>
      {children}
      <div className="crm-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`crm-toast crm-toast--${toast.variant}`}
          >
            <div className="crm-toast__inner">
              <ToastIcon variant={toast.variant} />
              <span className="crm-toast__message">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
    </CrmToastContext.Provider>
  );
}

export function useCrmToast(): CrmToastContextValue {
  const ctx = useContext(CrmToastContext);
  if (!ctx) {
    throw new Error('useCrmToast must be used within CrmToastProvider');
  }
  return ctx;
}
