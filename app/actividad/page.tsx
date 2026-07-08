import Link from "next/link";
import { getActivityReport, type ActivityPeriod } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { ActivityList } from "@/components/ActivityList";

export const dynamic = "force-dynamic";

const PERIODS: { key: ActivityPeriod; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "todo", label: "Todo" },
];

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

  // Semana → foco en echar; Mes/Todo → foco en participación (ascensos).
  const defaultSort = period === "semana" ? "kick" : "participacion";

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

      {/* Selector de periodo */}
      <div className="mb-2 flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/actividad?p=${p.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-extrabold transition ${
              period === p.key ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <p className="mb-1 text-xs text-ink-soft">
        Total del clan ({report.periodLabel}):{" "}
        <strong className="text-ink">{report.clanDonations.toLocaleString("es-ES")}</strong> donaciones ·{" "}
        <strong className="text-ink">{report.warsInPeriod}</strong> guerras · ⭐{" "}
        <strong className="text-ink">{report.clanWarStars}</strong>
      </p>
      <p className="mb-4 text-xs font-semibold text-ink-soft">
        Orden:{" "}
        {period === "semana"
          ? "candidatos a echar primero"
          : "más participativos primero (para ascensos)"}
      </p>

      <ActivityList
        members={report.members}
        thresholdDays={report.thresholdDays}
        warsInPeriod={report.warsInPeriod}
        defaultSort={defaultSort}
      />

      <p className="mt-3 text-xs text-ink-soft">
        <strong>Semana</strong> (lunes-domingo) para el día a día y a quién echar; <strong>Mes</strong> y
        <strong> Todo</strong> para ver participación acumulada y candidatos a subir. Los fallos de
        guerra solo cuentan rondas ya terminadas; la ronda en curso no penaliza.
      </p>
    </AppShell>
  );
}
