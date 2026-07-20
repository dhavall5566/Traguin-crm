'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { BellRing, CheckCircle2, AlertCircle, Info, UserPlus, Trash2 } from 'lucide-react';
import { registerCrmToastBus, type CrmToastBusPayload } from '@/lib/crm-toast-bus';

export type CrmToastVariant = 'success' | 'error' | 'info' | 'lead' | 'confirm';

type CrmToastItem = {
  id: string;
  message: string;
  variant: CrmToastVariant;
  leadKind?: 'new' | 'returning';
  exiting?: boolean;
  onAction?: () => void;
  actionLabel?: string;
};

type ShowToastOptions = {
  message: string;
  variant?: CrmToastVariant;
  durationMs?: number;
};

type ShowLeadToastOptions = {
  message: string;
  kind: 'new' | 'returning';
  durationMs?: number;
  onAction?: () => void;
};

type CrmToastContextValue = {
  showToast: (options: ShowToastOptions) => void;
  showLeadToast: (options: ShowLeadToastOptions) => void;
};

const CrmToastContext = createContext<CrmToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 2600;
const EXIT_MS = 360;

function ToastIcon({
  variant,
  leadKind,
}: {
  variant: CrmToastVariant;
  leadKind?: 'new' | 'returning';
}) {
  const className = 'crm-toast__icon';
  if (variant === 'lead') {
    return leadKind === 'returning' ? (
      <BellRing className={className} aria-hidden />
    ) : (
      <UserPlus className={className} aria-hidden />
    );
  }
  if (variant === 'error') return <AlertCircle className={className} aria-hidden />;
  if (variant === 'confirm') return <Trash2 className={className} aria-hidden />;
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

  const beginDismiss = useCallback(
    (id: string) => {
      setToasts((prev) =>
        prev.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
      );
      setTimeout(() => dismiss(id), EXIT_MS);
    },
    [dismiss],
  );

  const pushToast = useCallback(
    (item: Omit<CrmToastItem, 'id' | 'exiting'>, durationMs: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-2), { ...item, id, exiting: false }]);
      const timer = setTimeout(() => beginDismiss(id), durationMs);
      timersRef.current.set(id, timer);
    },
    [beginDismiss],
  );

  const showToast = useCallback(
    ({ message, variant = 'success', durationMs = DEFAULT_DURATION_MS }: ShowToastOptions) => {
      pushToast({ message, variant }, durationMs);
    },
    [pushToast],
  );

  const showLeadToast = useCallback(
    ({
      message,
      kind,
      durationMs = kind === 'new' ? 5200 : 4600,
      onAction,
    }: ShowLeadToastOptions) => {
      pushToast({ message, variant: 'lead', leadKind: kind, onAction }, durationMs);
    },
    [pushToast],
  );

  useEffect(() => {
    const handleBus = (payload: CrmToastBusPayload) => {
      const variant = payload.variant ?? 'success';
      if (variant === 'lead' && payload.leadKind) {
        pushToast(
          {
            message: payload.message,
            variant: 'lead',
            leadKind: payload.leadKind,
            onAction: payload.onAction,
            actionLabel: payload.actionLabel,
          },
          payload.durationMs ?? (payload.leadKind === 'new' ? 5200 : 4600),
        );
        return;
      }
      pushToast(
        {
          message: payload.message,
          variant,
          onAction: payload.onAction,
          actionLabel: payload.actionLabel,
        },
        payload.durationMs ?? DEFAULT_DURATION_MS,
      );
    };

    registerCrmToastBus(handleBus);
    return () => registerCrmToastBus(null);
  }, [pushToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <CrmToastContext.Provider value={{ showToast, showLeadToast }}>
      {children}
      <div className="crm-toast-stack" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            role="status"
            className={[
              'crm-toast',
              `crm-toast--${toast.variant}`,
              toast.leadKind ? `crm-toast--${toast.leadKind}` : '',
              toast.exiting ? 'crm-toast--exit' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ ['--toast-stack-index' as string]: index }}
          >
            <div className="crm-toast__glow" aria-hidden />
            {toast.onAction ? (
              <button
                type="button"
                className="crm-toast__inner crm-toast__inner--action"
                onClick={() => {
                  toast.onAction?.();
                  beginDismiss(toast.id);
                }}
              >
                <div className="crm-toast__icon-wrap" aria-hidden>
                  <ToastIcon variant={toast.variant} leadKind={toast.leadKind} />
                </div>
                <span className="crm-toast__message">{toast.message}</span>
                <span className="crm-toast__action">{toast.actionLabel ?? 'View'}</span>
              </button>
            ) : (
              <div className="crm-toast__inner">
                <div className="crm-toast__icon-wrap" aria-hidden>
                  <ToastIcon variant={toast.variant} leadKind={toast.leadKind} />
                </div>
                <span className="crm-toast__message">{toast.message}</span>
              </div>
            )}
            <button
              type="button"
              className="crm-toast__close"
              aria-label="Dismiss notification"
              onClick={() => beginDismiss(toast.id)}
            >
              ×
            </button>
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
