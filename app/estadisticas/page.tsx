import Link from "next/link";
import { getActivityReport, type ActivityPeriod } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const PERIODS: { key: ActivityPeriod; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "todo", label: "Todo" },
];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

function href(tag: string) {
  return `/member/${encodeURIComponent(tag)}`;
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const sp = await searchParams;
  const period: ActivityPeriod = sp.p === "mes" || sp.p === "todo" ? sp.p : "mes";

  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const report = await getActivityReport(period);

  const members = report.members;
  const activos = members.length;
  const media = activos > 0 ? Math.round(report.clanDonations / activos) : 0;

  const cats = {
    expulsar: members.filter((m) => m.category === "expulsion").length,
    pendiente: members.filter((m) => m.category === "revisar").length,
    destacables: members.filter((m) => m.category === "destacado").length,
  };

  const topDonantes = [...members]
    .filter((m) => (m.donations ?? 0) > 0)
    .sort((a, b) => (b.donations ?? 0) - (a.donations ?? 0))
    .slice(0, 5);
  const topGuerra = [...members]
    .filter((m) => m.warStars > 0)
    .sort((a, b) => b.warStars - a.warStars)
    .slice(0, 5);

  return (
    <AppShell email={user?.email}>
      <h1 className="ribbon-title mb-2 text-xl text-ink [text-shadow:none]">Estadísticas del clan</h1>

      {/* Periodo */}
      <div className="mb-4 flex gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/estadisticas?p=${p.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-extrabold transition ${
              period === p.key ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {/* Totales */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Stat label="Donaciones" value={report.clanDonations.toLocaleString("es-ES")} sub={`media ${media}/miembro`} />
        <Stat label="Estrellas de guerra" value={`⭐ ${report.clanWarStars}`} sub={`${report.warsInPeriod} guerras`} />
        <Stat label="Miembros activos" value={String(activos)} />
        <Stat label="A revisar / echar" value={`${cats.pendiente} / ${cats.expulsar}`} sub={`${cats.destacables} destacables`} />
      </div>

      {/* Top donantes */}
      <h2 className="mb-2 font-extrabold text-ink">🎁 Top donantes ({report.periodLabel})</h2>
      <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        {topDonantes.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">Sin datos en el periodo.</p>
        ) : (
          <ul className="divide-y divide-line">
            {topDonantes.map((m, i) => (
              <li key={m.tag} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="w-5 flex-none text-sm font-extrabold text-gold-deep">{i + 1}</span>
                <Link href={href(m.tag)} className="flex-1 truncate font-bold text-ink hover:underline">
                  {m.name}
                </Link>
                <span className="font-extrabold tabular-nums text-ink">
                  {(m.donations ?? 0).toLocaleString("es-ES")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Top guerra */}
      <h2 className="mb-2 font-extrabold text-ink">⭐ Top guerra ({report.periodLabel})</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {topGuerra.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">Sin datos de guerra en el periodo.</p>
        ) : (
          <ul className="divide-y divide-line">
            {topGuerra.map((m, i) => (
              <li key={m.tag} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="w-5 flex-none text-sm font-extrabold text-gold-deep">{i + 1}</span>
                <Link href={href(m.tag)} className="flex-1 truncate font-bold text-ink hover:underline">
                  {m.name}
                </Link>
                <span className="font-extrabold tabular-nums text-ink">⭐ {m.warStars}</span>
                <span className="text-xs text-ink-soft">{m.warAttacks} ataques</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Totales del clan en el periodo. Para gestión individual (a quién echar/subir) usa la pestaña
        Actividad.
      </p>
    </AppShell>
  );
}
