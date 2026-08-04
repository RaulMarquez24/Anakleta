import { getActivityReport } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { ActivityList } from "@/components/ActivityList";

export const dynamic = "force-dynamic";

export default async function ActividadPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const report = await getActivityReport();

  return (
    <AppShell email={user?.email} title="Actividad">
      <ActivityList
        members={report.members}
        thresholdDays={report.thresholdDays}
        windowDays={report.windowDays}
        defaultSort="inactivo"
      />
    </AppShell>
  );
}
