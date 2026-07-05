import {
  fetchAgencySmtpSettings,
  saveAgencySmtpSettings,
  sendAgencySmtpTestEmail,
  type AgencySmtpSettings,
  type AgencySmtpSettingsInput,
} from "@/lib/api/smtp-settings";

export type {
  AgencySmtpSettings,
  AgencySmtpSettingsInput,
};

export {
  fetchAgencySmtpSettings,
  saveAgencySmtpSettings,
  sendAgencySmtpTestEmail,
};

let cachedAgencyId: string | null = null;
let cachedSettings: AgencySmtpSettings | null = null;
let inFlight: Promise<AgencySmtpSettings> | null = null;

export function getCachedAgencySmtpSettings(agencyId: string): AgencySmtpSettings | null {
  if (cachedAgencyId === agencyId && cachedSettings) return cachedSettings;
  return null;
}

export function primeAgencySmtpSettings(agencyId: string, settings: AgencySmtpSettings): void {
  cachedAgencyId = agencyId;
  cachedSettings = settings;
}

export function invalidateAgencySmtpSettingsCache(): void {
  cachedAgencyId = null;
  cachedSettings = null;
}

export async function loadAgencySmtpSettings(
  agencyId: string,
  options?: { force?: boolean },
): Promise<AgencySmtpSettings> {
  if (!options?.force) {
    const hit = getCachedAgencySmtpSettings(agencyId);
    if (hit) return hit;
    if (inFlight) return inFlight;
  }

  inFlight = fetchAgencySmtpSettings()
    .then((settings) => {
      primeAgencySmtpSettings(agencyId, settings);
      return settings;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export async function persistAgencySmtpSettings(
  agencyId: string,
  payload: AgencySmtpSettingsInput,
): Promise<AgencySmtpSettings> {
  const saved = await saveAgencySmtpSettings(payload);
  primeAgencySmtpSettings(agencyId, saved);
  return saved;
}
