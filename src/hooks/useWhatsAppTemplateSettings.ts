'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  getCachedAgencyWhatsAppTemplateSettings,
  getCachedWhatsAppTemplateCatalog,
  loadAgencyWhatsAppTemplateSettings,
  loadWhatsAppTemplateCatalog,
  persistAgencyWhatsAppTemplateSettings,
  type AgencyWhatsAppTemplateSettings,
  type AgencyWhatsAppTemplateSettingsInput,
  type WhatsAppTemplateCatalogEntry,
} from '@/lib/api/whatsapp-template-settings-cache';

export function useWhatsAppTemplateSettings() {
  const agencyId = useStore((s) => s.currentAgency.id);

  const cachedSettings = getCachedAgencyWhatsAppTemplateSettings(agencyId);
  const cachedCatalog = getCachedWhatsAppTemplateCatalog();

  const [settings, setSettings] = useState<AgencyWhatsAppTemplateSettings | null>(
    () => cachedSettings,
  );
  const [catalog, setCatalog] = useState<WhatsAppTemplateCatalogEntry[] | null>(
    () => cachedCatalog,
  );
  const [loading, setLoading] = useState(() => !cachedSettings || !cachedCatalog);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const warmSettings = getCachedAgencyWhatsAppTemplateSettings(agencyId);
    const warmCatalog = getCachedWhatsAppTemplateCatalog();

    if (warmSettings) setSettings(warmSettings);
    if (warmCatalog) setCatalog(warmCatalog);
    if (warmSettings && warmCatalog) setLoading(false);

    void (async () => {
      if (!warmSettings || !warmCatalog) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [nextSettings, nextCatalog] = await Promise.all([
          loadAgencyWhatsAppTemplateSettings(agencyId, { force: Boolean(warmSettings) }),
          loadWhatsAppTemplateCatalog({ force: Boolean(warmCatalog) }),
        ]);
        if (!cancelled) {
          setSettings(nextSettings);
          setCatalog(nextCatalog);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load WhatsApp template settings');
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
    async (payload: AgencyWhatsAppTemplateSettingsInput) => {
      const saved = await persistAgencyWhatsAppTemplateSettings(agencyId, payload);
      setSettings(saved);
      return saved;
    },
    [agencyId],
  );

  return {
    settings,
    catalog,
    loading,
    refreshing,
    error,
    save,
  };
}
