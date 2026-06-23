/** CMS admin app (traguin). Override with NEXT_PUBLIC_CMS_APP_URL in .env.local */
export function getCmsAppUrl(): string {
  return process.env.NEXT_PUBLIC_CMS_APP_URL ?? "http://localhost:3001/admin/cms";
}

/** CRM dashboard entry. Override with NEXT_PUBLIC_CRM_APP_URL in .env.local */
export function getCrmAppUrl(): string {
  return process.env.NEXT_PUBLIC_CRM_APP_URL ?? "http://localhost:3002/dashboard";
}
