import { SessionBootstrap } from "@/components/auth/SessionBootstrap";
import { getServerCrmSession } from "@/lib/auth-server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerCrmSession();

  return (
    <>
      <SessionBootstrap session={session} />
      {children}
    </>
  );
}
