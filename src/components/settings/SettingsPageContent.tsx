'use client';

import { SettingsGeneralPanel } from '@/components/settings/SettingsGeneralPanel';
import { SettingsSmtpPanel } from '@/components/settings/SettingsSmtpPanel';
import { useSettingsTab } from '@/components/settings/SettingsTabContext';

export function SettingsPageContent() {
  const { tab } = useSettingsTab();

  return (
    <>
      <div hidden={tab !== 'general'} aria-hidden={tab !== 'general'}>
        <SettingsGeneralPanel />
      </div>
      <div hidden={tab !== 'smtp'} aria-hidden={tab !== 'smtp'}>
        <SettingsSmtpPanel />
      </div>
    </>
  );
}
