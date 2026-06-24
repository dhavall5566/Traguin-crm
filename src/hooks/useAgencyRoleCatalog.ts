"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sortAgencyRoleDefinitions, syncAgencyRoleCatalog } from "@/lib/api/role-catalog";
import { useStore } from "@/lib/store";

/** Unified agency roles for assignment dropdowns (local RBAC + API). */
export function useAgencyRoleCatalog() {
  const agencyId = useStore((s) => s.currentAgency.id);
  const roleDefinitions = useStore((s) => s.roleDefinitions);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setSyncing(true);
    try {
      await syncAgencyRoleCatalog(agencyId);
    } finally {
      setSyncing(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const agencyRoleDefs = useMemo(
    () => sortAgencyRoleDefinitions(roleDefinitions.filter((r) => r.agencyId === agencyId)),
    [roleDefinitions, agencyId],
  );

  return { agencyRoleDefs, syncing, refresh };
}
