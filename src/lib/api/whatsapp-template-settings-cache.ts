import {
  fetchAgencyWhatsAppTemplateSettings,
  fetchWhatsAppTemplateCatalog,
  saveAgencyWhatsAppTemplateSettings,
  type AgencyWhatsAppTemplateSettings,
  type AgencyWhatsAppTemplateSettingsInput,
  type WhatsAppTemplateCatalogEntry,
} from "@/lib/api/whatsapp-template-settings";

export type {
  AgencyWhatsAppTemplateSettings,
  AgencyWhatsAppTemplateSettingsInput,
  WhatsAppTemplateCatalogEntry,
};

export {
  fetchAgencyWhatsAppTemplateSettings,
  fetchWhatsAppTemplateCatalog,
  saveAgencyWhatsAppTemplateSettings,
};

let cachedAgencyId: string | null = null;
let cachedSettings: AgencyWhatsAppTemplateSettings | null = null;
let cachedCatalog: WhatsAppTemplateCatalogEntry[] | null = null;
let settingsInFlight: Promise<AgencyWhatsAppTemplateSettings> | null = null;
let catalogInFlight: Promise<WhatsAppTemplateCatalogEntry[]> | null = null;

export function getCachedAgencyWhatsAppTemplateSettings(
  agencyId: string,
): AgencyWhatsAppTemplateSettings | null {
  if (cachedAgencyId === agencyId && cachedSettings) return cachedSettings;
  return null;
}

export function getCachedWhatsAppTemplateCatalog(): WhatsAppTemplateCatalogEntry[] | null {
  return cachedCatalog;
}

export function primeAgencyWhatsAppTemplateSettings(
  agencyId: string,
  settings: AgencyWhatsAppTemplateSettings,
): void {
  cachedAgencyId = agencyId;
  cachedSettings = settings;
}

export function primeWhatsAppTemplateCatalog(catalog: WhatsAppTemplateCatalogEntry[]): void {
  cachedCatalog = catalog;
}

export async function loadAgencyWhatsAppTemplateSettings(
  agencyId: string,
  options?: { force?: boolean },
): Promise<AgencyWhatsAppTemplateSettings> {
  if (!options?.force) {
    const hit = getCachedAgencyWhatsAppTemplateSettings(agencyId);
    if (hit) return hit;
    if (settingsInFlight) return settingsInFlight;
  }

  settingsInFlight = fetchAgencyWhatsAppTemplateSettings()
    .then((settings) => {
      primeAgencyWhatsAppTemplateSettings(agencyId, settings);
      return settings;
    })
    .finally(() => {
      settingsInFlight = null;
    });

  return settingsInFlight;
}

export async function loadWhatsAppTemplateCatalog(options?: {
  force?: boolean;
}): Promise<WhatsAppTemplateCatalogEntry[]> {
  if (!options?.force && cachedCatalog) return cachedCatalog;
  if (!options?.force && catalogInFlight) return catalogInFlight;

  catalogInFlight = fetchWhatsAppTemplateCatalog()
    .then((catalog) => {
      primeWhatsAppTemplateCatalog(catalog);
      return catalog;
    })
    .finally(() => {
      catalogInFlight = null;
    });

  return catalogInFlight;
}

export async function persistAgencyWhatsAppTemplateSettings(
  agencyId: string,
  payload: AgencyWhatsAppTemplateSettingsInput,
): Promise<AgencyWhatsAppTemplateSettings> {
  const saved = await saveAgencyWhatsAppTemplateSettings(payload);
  primeAgencyWhatsAppTemplateSettings(agencyId, saved);
  return saved;
}
