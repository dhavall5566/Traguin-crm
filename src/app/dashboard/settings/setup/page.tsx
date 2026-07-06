import { redirect } from 'next/navigation';

export default function SetupSettingsRedirectPage() {
  redirect('/dashboard/settings/general');
}
