import Link from "next/link";
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
    <AppShell email={user?.email}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">Actividad</h1>
        <Link
          href="/bajas"
          className="rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-surface-2"
        >
          📤 Bajas
        </Link>
      </div>

      <p className="mb-3 text-xs text-ink-soft">
        Actividad de cada miembro {report.periodLabel}. Filtra por grupo y ordena por la métrica que
        quieras.
      </p>

      <ActivityList
        members={report.members}
        thresholdDays={report.thresholdDays}
        warsInPeriod={report.warsInPeriod}
        defaultSort={defaultSort}
        period={period}
      />

      <p className="mt-3 text-xs text-ink-soft">
        <strong>Semana</strong> (lunes-domingo) para el día a día y a quién echar; <strong>Mes</strong> y
        <strong> Todo</strong> para ver participación acumulada y candidatos a subir. Los fallos de
        guerra solo cuentan rondas ya terminadas; la ronda en curso no penaliza.
      </p>
    </AppShell>
  );
}
