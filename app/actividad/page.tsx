import Link from "next/link";
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
    <AppShell email={user?.email}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">Actividad</h1>
        <Link
          href="/bajas"
          className="rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-surface-2"
        >
          📤 Bajas
        </Link>
      </div>
      <p className="mb-4 text-xs text-ink-soft">
        Últimos {report.lookbackDays} días · {report.warsInPeriod} guerras · ordenado por defecto:
        candidatos a echar primero.
      </p>

      <ActivityList
        members={report.members}
        thresholdDays={report.thresholdDays}
        warsInPeriod={report.warsInPeriod}
      />

      <p className="mt-3 text-xs text-ink-soft">
        <strong>Categorías:</strong> 🔴 Expulsión (inactivo ≥ 14 días o ≥ 3 fallos de guerra) · 🟡
        Revisar (≥ {report.thresholdDays} días, algún fallo o ratio &lt; 1) · 🟢 Destacado (activo,
        sin fallos y buen aporte) · Mando (líderes/colíderes, no se juzgan). &ldquo;Última
        actividad&rdquo; se infiere de las señales entre capturas; la API no da la conexión real.
      </p>
    </AppShell>
  );
}
