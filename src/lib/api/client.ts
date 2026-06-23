const DEFAULT_BASE = "http://127.0.0.1:8001";

export function getCrmApiBaseUrl(): string {
  return (process.env.CRM_API_URL ?? DEFAULT_BASE).replace(/\/$/, "");
}
