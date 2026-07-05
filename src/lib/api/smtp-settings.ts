import { crmFetchJson } from "@/lib/api/crm-client";

export type AgencySmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  use_tls: boolean;
  use_ssl: boolean;
  username: string;
  from_email: string;
  from_name: string;
  password_configured: boolean;
};

export type AgencySmtpSettingsInput = {
  enabled?: boolean;
  host?: string;
  port?: number;
  use_tls?: boolean;
  use_ssl?: boolean;
  username?: string;
  password?: string;
  from_email?: string;
  from_name?: string;
};

export function fetchAgencySmtpSettings(): Promise<AgencySmtpSettings> {
  return crmFetchJson<AgencySmtpSettings>("/api/crm/settings/smtp");
}

export function saveAgencySmtpSettings(
  payload: AgencySmtpSettingsInput,
): Promise<AgencySmtpSettings> {
  return crmFetchJson<AgencySmtpSettings>("/api/crm/settings/smtp", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function sendAgencySmtpTestEmail(toEmail?: string): Promise<{ message: string }> {
  return crmFetchJson<{ message: string }>("/api/crm/settings/smtp/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toEmail ? { to_email: toEmail } : {}),
  });
}
