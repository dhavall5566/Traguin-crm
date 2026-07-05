'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  getCachedAgencySmtpSettings,
  loadAgencySmtpSettings,
  persistAgencySmtpSettings,
  sendAgencySmtpTestEmail,
  type AgencySmtpSettings,
  type AgencySmtpSettingsInput,
} from '@/lib/api/smtp-settings-cache';

export function useSmtpSettings() {
  const agencyId = useStore((s) => s.currentAgency.id);
  const userEmail = useStore((s) => s.currentUser?.email ?? '');

  const cached = getCachedAgencySmtpSettings(agencyId);
  const [settings, setSettings] = useState<AgencySmtpSettings | null>(() => cached);
  const [loading, setLoading] = useState(() => !cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const warm = getCachedAgencySmtpSettings(agencyId);
    if (warm) {
      setSettings(warm);
      setLoading(false);
    }

    void (async () => {
      if (!warm) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const next = await loadAgencySmtpSettings(agencyId, { force: Boolean(warm) });
        if (!cancelled) setSettings(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load SMTP settings');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  const save = useCallback(
    async (payload: AgencySmtpSettingsInput) => {
      const saved = await persistAgencySmtpSettings(agencyId, payload);
      setSettings(saved);
      return saved;
    },
    [agencyId],
  );

  const sendTest = useCallback(
    (toEmail?: string) => sendAgencySmtpTestEmail(toEmail?.trim() || userEmail || undefined),
    [userEmail],
  );

  return {
    settings,
    loading,
    refreshing,
    error,
    save,
    sendTest,
    testEmailDefault: userEmail,
  };
}
