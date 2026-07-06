'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  fetchAgencyLeadMailSettings,
  saveAgencyLeadMailSettings,
  type AgencyLeadMailSettings,
  type AgencyLeadMailSettingsInput,
  type LeadMailEventInput,
  type LeadMailEventType,
} from '@/lib/api/lead-mail-settings';

export function useLeadMailSettings() {
  const agencyId = useStore((s) => s.currentAgency.id);

  const [settings, setSettings] = useState<AgencyLeadMailSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAgencyLeadMailSettings();
      setSettings(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load email configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchAgencyLeadMailSettings();
        if (!cancelled) setSettings(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load email configuration');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  const save = useCallback(async (payload: AgencyLeadMailSettingsInput) => {
    setError(null);
    try {
      await saveAgencyLeadMailSettings(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save email configuration';
      setError(message);
      throw err;
    }
  }, []);

  const saveEvent = useCallback(
    async (event: LeadMailEventInput) => {
      return save({ events: [event] });
    },
    [save],
  );

  return {
    settings,
    loading,
    error,
    save,
    saveEvent,
    reload,
  };
}
