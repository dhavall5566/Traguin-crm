import { LeadDetailPage } from '@/components/crm/LeadDetailPage';

export default async function LeadDetailRoute({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <LeadDetailPage leadId={leadId} />;
}
