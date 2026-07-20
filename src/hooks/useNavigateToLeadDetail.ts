'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { navigateToLeadDetail } from '@/lib/crm-lead-navigation';

/** Navigate to a lead detail page in the same browser tab. */
export function useNavigateToLeadDetail() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (leadId: string) => {
      navigateToLeadDetail(router, leadId, pathname);
    },
    [router, pathname],
  );
}
