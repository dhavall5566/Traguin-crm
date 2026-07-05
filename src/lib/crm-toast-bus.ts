'use client';

export type CrmToastBusVariant = 'success' | 'error' | 'info' | 'lead';

export type CrmToastBusPayload = {
  message: string;
  variant?: CrmToastBusVariant;
  durationMs?: number;
  onAction?: () => void;
  leadKind?: 'new' | 'returning';
};

type CrmToastBusHandler = (payload: CrmToastBusPayload) => void;

let handler: CrmToastBusHandler | null = null;

export function registerCrmToastBus(next: CrmToastBusHandler | null): void {
  handler = next;
}

export function crmToast(payload: CrmToastBusPayload): void {
  handler?.(payload);
}

export function crmToastSuccess(message: string, durationMs = 2600): void {
  crmToast({ message, variant: 'success', durationMs });
}

export function crmToastError(message: string, durationMs = 3400): void {
  crmToast({ message, variant: 'error', durationMs });
}

export function crmToastInfo(message: string, durationMs = 2800): void {
  crmToast({ message, variant: 'info', durationMs });
}

export async function runCrmAction<T>(
  label: string,
  run: () => Promise<T>,
  successMessage?: string,
): Promise<T | undefined> {
  try {
    const result = await run();
    crmToastSuccess(successMessage ?? `${label} completed`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : `${label} failed`;
    crmToastError(message);
    throw error;
  }
}
