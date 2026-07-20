import { crmFetchJson } from "@/lib/api/crm-client";

export type NotificationMatrixRow = {
  event: string;
  label: string;
  customer: boolean;
  rm: boolean;
  account: boolean;
  ops_head: boolean;
  admin: boolean;
};

export async function fetchNotificationMatrix(): Promise<NotificationMatrixRow[]> {
  return crmFetchJson<NotificationMatrixRow[]>("/api/crm/settings/notification-matrix");
}
