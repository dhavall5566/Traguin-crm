'use client';

import { useEffect } from 'react';
import { loadAgencySmtpSettings } from '@/lib/api/smtp-settings-cache';
import { canAccessModuleView } from '@/lib/rbac';
import { useStore } from '@/lib/store';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const agencyId = useStore((s) => s.currentAgency.id);
  const currentUser = useStore((s) => s.currentUser);
  const roleDefinitions = useStore((s) => s.roleDefinitions);

  useEffect(() => {
    if (!currentUser) return;
    const canView = canAccessModuleView(
      currentUser.role,
      agencyId,
      'workspace_settings',
      roleDefinitions,
    );
    if (canView) void loadAgencySmtpSettings(agencyId);
  }, [agencyId, currentUser, roleDefinitions]);

  return (
    <div className="space-y-5 text-xs pb-10">
      <div className="crm-page-header border-b border-border/60 pb-4">
        <div className="min-w-0">
          <h1 className="crm-page-header__title">Workspace settings</h1>
          <p className="crm-page-header__meta">
            Layout, billing defaults, email delivery, and workspace tools.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
