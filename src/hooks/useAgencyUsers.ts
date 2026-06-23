"use client";

import { useCallback, useEffect, useState } from "react";
import { listAgencyUsers } from "@/lib/api/users";
import type { User } from "@/lib/store";

export function useAgencyUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const staff = await listAgencyUsers();
      setUsers(staff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team members");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { users, loading, error, refresh };
}
