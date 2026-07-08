import Link from "next/link";
import { getActivityReport, type ActivityPeriod } from "@/lib/history";
import { getCurrentWar } from "@/lib/war";
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
  const [report, war] = await Promise.all([
    getActivityReport(period),
    getCurrentWar().catch(() => null),
  ]);

  const liveWar =
    war && war.state === "inWar"
      ? {
          pending: war.pending.map((m) => ({ tag: m.tag, name: m.name })),
          endsAt: war.endTime,
          label: war.isCwl ? `CWL${war.round ? ` · Ronda ${war.round}` : ""}` : "la guerra",
        }
      : null;

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

      <p className="mb-4 text-xs text-ink-soft">
        {report.periodLabel} · {report.warsInPeriod} guerras · {report.clanDonations.toLocaleString("es-ES")} donaciones · ⭐ {report.clanWarStars}
        {period === "semana"
          ? " · orden: candidatos a echar"
          : " · orden: más participativos (para subir)"}
      </p>

      <ActivityList
        members={report.members}
        thresholdDays={report.thresholdDays}
        warsInPeriod={report.warsInPeriod}
        liveWar={liveWar}
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
