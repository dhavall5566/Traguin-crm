const CRM_PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/operations": "Weekly schedule",
  "/dashboard/crm": "Leads",
  "/dashboard/customers": "Customers",
  "/dashboard/bookings": "Bookings",
  "/dashboard/packages": "Packages",
  "/dashboard/itinerary": "Trip planner",
  "/dashboard/vendors": "Vendors",
  "/dashboard/finance": "Billing",
  "/dashboard/employees": "Team access",
  "/dashboard/settings": "Settings",
  "/dashboard/settings/general": "Settings",
  "/dashboard/settings/email-setup": "Email Setup",
  "/dashboard/settings/smtp": "SMTP",
  "/dashboard/settings/email": "Email configuration",
  "/dashboard/settings/whatsapp": "WhatsApp templates",
};

export function getCrmBreadcrumbLabel(pathname: string): string {
  if (CRM_PAGE_LABELS[pathname]) return CRM_PAGE_LABELS[pathname];

  const match = Object.entries(CRM_PAGE_LABELS)
    .filter(([path]) => path !== "/dashboard")
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(path));

  return match?.[1] ?? "Workspace";
}
