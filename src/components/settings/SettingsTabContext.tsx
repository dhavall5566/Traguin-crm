'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type SettingsTab = 'general' | 'smtp';

type SettingsTabContextValue = {
  tab: SettingsTab;
  setTab: (tab: SettingsTab) => void;
};

const SettingsTabContext = createContext<SettingsTabContextValue | null>(null);

export function SettingsTabProvider({
  children,
  initialTab = 'general',
}: {
  children: React.ReactNode;
  initialTab?: SettingsTab;
}) {
  const router = useRouter();
  const rawPath = usePathname();
  const pathname = rawPath.replace(/\/smtp\/?$/, '') || '/dashboard/settings';

  const [tab, setTabState] = useState<SettingsTab>(initialTab);

  const setTab = useCallback(
    (next: SettingsTab) => {
      setTabState(next);
      const params = new URLSearchParams();
      if (next === 'smtp') params.set('tab', 'smtp');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ tab, setTab }), [tab, setTab]);

  return <SettingsTabContext.Provider value={value}>{children}</SettingsTabContext.Provider>;
}

export function useSettingsTab() {
  const ctx = useContext(SettingsTabContext);
  if (!ctx) {
    throw new Error('useSettingsTab must be used within SettingsTabProvider');
  }
  return ctx;
}
