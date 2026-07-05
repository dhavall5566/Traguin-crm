import { redirect } from 'next/navigation';

export default function SmtpSettingsRedirectPage() {
  redirect('/dashboard/settings?tab=smtp');
}
