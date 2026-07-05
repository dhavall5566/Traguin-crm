import { SettingsShell } from '@/components/settings/SettingsShell';
import type { SettingsTab } from '@/components/settings/SettingsTabContext';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const initialTab: SettingsTab = params.tab === 'smtp' ? 'smtp' : 'general';
  return <SettingsShell initialTab={initialTab} />;
}
