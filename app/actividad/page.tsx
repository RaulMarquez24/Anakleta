import { getActivityReport, type ActivityPeriod } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { ActivityList } from "@/components/ActivityList";

export const dynamic = "force-dynamic";

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const sp = await searchParams;
  const period: ActivityPeriod =
    sp.p === "mes" || sp.p === "todo" ? sp.p : "semana";

  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const report = await getActivityReport(period);

  // Semana → foco en inactividad (día a día); Mes/Todo → participación (ascensos).
  const defaultSort = period === "semana" ? "inactivo" : "participacion";

  return (
    <AppShell email={user?.email} title="Actividad">
      <ActivityList
        members={report.members}
        thresholdDays={report.thresholdDays}
        warsInPeriod={report.warsInPeriod}
        defaultSort={defaultSort}
        period={period}
      />
    </AppShell>
  );
}
