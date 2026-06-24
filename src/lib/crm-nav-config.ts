import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  DollarSign,
  ShieldAlert,
  Map,
  Layers,
  CalendarRange,
  ClipboardList,
  Settings,
} from "lucide-react";
import { RBAC_NAV_MODULE, type RbacModuleKey } from "@/lib/rbac";

export type CrmNavItem = {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  rbacModule: RbacModuleKey;
};

export type CrmNavGroup = {
  label: string;
  items: CrmNavItem[];
};

/** Sidebar navigation grouped to match the Traguin CRM shell design. */
export const CRM_NAV_GROUPS: CrmNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        rbacModule: RBAC_NAV_MODULE["/dashboard"],
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        name: "Leads",
        href: "/dashboard/crm",
        icon: Layers,
        rbacModule: RBAC_NAV_MODULE["/dashboard/crm"],
      },
      {
        name: "Weekly schedule",
        href: "/dashboard/operations",
        icon: CalendarRange,
        rbacModule: RBAC_NAV_MODULE["/dashboard/operations"],
      },
      {
        name: "Customers",
        href: "/dashboard/customers",
        icon: Users,
        rbacModule: RBAC_NAV_MODULE["/dashboard/customers"],
      },
      {
        name: "Bookings",
        href: "/dashboard/bookings",
        icon: ClipboardList,
        rbacModule: RBAC_NAV_MODULE["/dashboard/bookings"],
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        name: "Trip planner",
        href: "/dashboard/itinerary",
        icon: Map,
        rbacModule: RBAC_NAV_MODULE["/dashboard/itinerary"],
      },
      {
        name: "Vendors",
        href: "/dashboard/vendors",
        icon: Building2,
        rbacModule: RBAC_NAV_MODULE["/dashboard/vendors"],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        name: "Billing",
        href: "/dashboard/finance",
        icon: DollarSign,
        rbacModule: RBAC_NAV_MODULE["/dashboard/finance"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        name: "Team access",
        href: "/dashboard/employees",
        icon: ShieldAlert,
        rbacModule: RBAC_NAV_MODULE["/dashboard/employees"],
      },
      {
        name: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        rbacModule: "workspace_settings",
      },
    ],
  },
];

export const CRM_NAV_FLAT: CrmNavItem[] = CRM_NAV_GROUPS.flatMap((g) => g.items);
