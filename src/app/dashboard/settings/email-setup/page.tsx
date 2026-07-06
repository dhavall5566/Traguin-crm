import { redirect } from 'next/navigation';

export default function EmailSetupRedirectPage() {
  redirect('/dashboard/settings/smtp');
}
