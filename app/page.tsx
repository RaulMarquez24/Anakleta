import Link from "next/link";
import Image from "next/image";
import { getMembersOverview, getClanTrends } from "@/lib/dashboard";
import { getActivityReport, type ActivityPeriod } from "@/lib/history";
import { getCurrentWar } from "@/lib/war";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { LineChart } from "@/components/LineChart";

export const dynamic = "force-dynamic";

const PERIODS: { key: ActivityPeriod; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "todo", label: "Todo" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function href(tag: string) {
  return `/member/${encodeURIComponent(tag)}`;
}

// Inicio del periodo en ms (UTC) para recortar las series a la ventana elegida.
function periodStartMs(period: ActivityPeriod): number {
  const now = new Date();
  if (period === "todo") return 0;
  if (period === "mes") return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const dow = (now.getUTCDay() + 6) % 7; // 0 = lunes
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

export default async function ClanHomePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const sp = await searchParams;
  const period: ActivityPeriod = sp.p === "mes" || sp.p === "todo" ? sp.p : "semana";

  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [data, week, report, war, trends] = await Promise.all([
    getMembersOverview(),
    getActivityReport("semana"), // gestión = estado actionable de la semana
    getActivityReport(period), // resumen/tops = periodo elegido
    getCurrentWar().catch(() => null),
    getClanTrends(),
  ]);

  // Gestión: siempre de la semana (a quién hay que atender ahora).
  const cats = {
    expulsar: week.members.filter((m) => m.category === "expulsion").length,
    revisar: week.members.filter((m) => m.category === "revisar").length,
    destacables: week.members.filter((m) => m.category === "destacado").length,
  };
  // "Al día": el resto (total − los tres cubos de gestión).
  const alDia = Math.max(0, week.members.length - cats.expulsar - cats.revisar - cats.destacables);

  // Resumen/tops del periodo elegido.
  const activos = report.members.length;
  const media = activos > 0 ? Math.round(report.clanDonations / activos) : 0;
  const topDon = [...report.members]
    .filter((m) => (m.donations ?? 0) > 0)
    .sort((a, b) => (b.donations ?? 0) - (a.donations ?? 0))
    .slice(0, 3);
  const topWar = [...report.members]
    .filter((m) => m.warStars > 0)
    .sort((a, b) => b.warStars - a.warStars)
    .slice(0, 3);

  const inWar = war && (war.state === "inWar" || war.state === "preparation");
  const left = timeLeft(war?.endTime ?? null);

  // Recorta la evolución a la ventana del periodo elegido (el selector hace zoom).
  const startMs = periodStartMs(period);
  const trophySeries = trends.filter((p) => p.t >= startMs).map((p) => ({ t: p.t, v: p.trophies }));

  return (
    <AppShell email={user?.email} title="Clan">
      {/* Identidad del clan */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          {data.clanBadgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.clanBadgeUrl}
              alt=""
              width={80}
              height={80}
              className="h-20 w-20 flex-none"
              style={{ objectFit: "contain" }}
            />
          ) : (
            <Image
              src="/logo.jpg"
              alt=""
              aria-hidden
              width={80}
              height={80}
              className="h-20 w-20 flex-none rounded-2xl shadow-[0_0_0_2px_var(--gold)]"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-extrabold text-ink">{data.clanName ?? "Añakleta"}</p>
            {data.clanWarLeague && (
              <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-extrabold text-gold-deep">
                ⚔️ {data.clanWarLeague}
              </span>
            )}
          </div>
          {/* Miembros: badge grande a la derecha */}
          <div className="flex-none rounded-xl bg-surface-2 px-3 py-1.5 text-center">
            <p className="text-2xl font-extrabold leading-none text-ink">{data.members.length}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">miembros</p>
          </div>
        </div>

        {data.clanDescription && (
          <p className="mt-3 whitespace-pre-line text-[12px] leading-snug text-ink-soft">
            {data.clanDescription}
          </p>
        )}

        {/* Datos rápidos del clan */}
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
          {data.clanPoints != null && (
            <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">🏆 {data.clanPoints.toLocaleString("es-ES")} pts</span>
          )}
          {data.clanWarWins != null && (
            <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">⚔️ {data.clanWarWins} guerras ganadas</span>
          )}
          {data.clanWarWinStreak != null && data.clanWarWinStreak > 0 && (
            <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">🔥 racha {data.clanWarWinStreak}</span>
          )}
          {data.clanRequiredTrophies != null && (
            <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink-soft">copas mín. {data.clanRequiredTrophies}</span>
          )}
        </div>

        <p className="mt-3 text-[11px] text-ink-soft">Última captura: {fmtDate(data.latestCapture)}</p>
      </div>

      {/* Estado de guerra / CWL */}
      <Link
        href="/guerras"
        className="mb-4 block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        {inWar ? (
          <>
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-ink">
                {war!.isCwl ? `🏆 Liga de Clanes · Ronda ${war!.round ?? "—"}` : "⚔️ En guerra"}
              </p>
              <span className="text-ink-soft">›</span>
            </div>
            <p className="mt-1 text-sm font-bold text-ink-soft">
              vs {war!.opponentName ?? "—"}
              {war!.state === "preparation" ? (
                <span className="ml-2 rounded-full bg-sky/15 px-2 py-0.5 text-[11px] font-extrabold text-sky">
                  Preparación
                </span>
              ) : (
                <>
                  {" · "}
                  <span className="font-extrabold text-ink">
                    {war!.clanStars ?? 0}–{war!.opponentStars ?? 0} ⭐
                  </span>
                  {left && <> · quedan {left}</>}
                </>
              )}
            </p>
            {war!.state === "inWar" && war!.pending.length > 0 && (
              <p className="mt-1 text-xs font-bold text-banner">{war!.pending.length} sin atacar</p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink-soft">🕊️ Sin guerra ahora mismo</p>
            <span className="text-ink-soft">›</span>
          </div>
        )}
      </Link>

      {/* Gestión rápida (siempre de la semana) */}
      <Link
        href="/actividad"
        className="mb-6 block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="font-extrabold text-ink">Gestión de esta semana</p>
          <span className="text-ink-soft">›</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-sky/12 py-2">
            <p className="text-2xl font-extrabold text-sky">{alDia}</p>
            <p className="text-[11px] font-bold text-ink-soft">Al día</p>
          </div>
          <div className="rounded-xl bg-gold/12 py-2">
            <p className="text-2xl font-extrabold text-gold-deep">{cats.revisar}</p>
            <p className="text-[11px] font-bold text-ink-soft">A revisar</p>
          </div>
          <div className="rounded-xl bg-banner/12 py-2">
            <p className="text-2xl font-extrabold text-banner">{cats.expulsar}</p>
            <p className="text-[11px] font-bold text-ink-soft">A echar</p>
          </div>
          <div className="rounded-xl bg-grass/12 py-2">
            <p className="text-2xl font-extrabold text-grass">{cats.destacables}</p>
            <p className="text-[11px] font-bold text-ink-soft">Destacables</p>
          </div>
        </div>
      </Link>

      {/* Mensajes del clan (reclutamiento / anuncios para copiar al juego) */}
      <Link
        href="/mensajes"
        className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        <span className="text-2xl">✉️</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">Mensajes del clan</span>
          <span className="block text-xs text-ink-soft">Reclutar o anunciar · listos para copiar</span>
        </span>
        <span aria-hidden className="text-ink-soft">›</span>
      </Link>

      {/* Avisar por Discord (mensaje libre etiquetando miembros/rol) */}
      <Link
        href="/discord"
        className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        <span className="text-2xl">🔔</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">Avisar por Discord</span>
          <span className="block text-xs text-ink-soft">Mensaje libre etiquetando a quien quieras</span>
        </span>
        <span aria-hidden className="text-ink-soft">›</span>
      </Link>

      {/* --- Análisis del clan (antes "Stats") --- */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-extrabold text-ink">Análisis del clan</h2>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/?p=${p.key}`}
              className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                period === p.key ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Totales del periodo */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat
          label="Donaciones"
          value={report.clanDonations.toLocaleString("es-ES")}
          sub={`media ${media}/miembro`}
        />
        <Stat label="Estrellas de guerra" value={`⭐ ${report.clanWarStars}`} sub={`${report.warsInPeriod} guerras`} />
      </div>

      {/* Evolución del clan (nivel de copas en la ventana del periodo) */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-2 flex items-center gap-2 font-extrabold text-gold-deep">
          <span aria-hidden>🏆</span> Copas del clan
        </h3>
        <LineChart series={[{ label: "Copas", color: "var(--gold-deep)", points: trophySeries }]} />
        <p className="mt-2 text-[11px] text-ink-soft">
          Suma de copas de todos los miembros en cada captura. Cae cada lunes por el reinicio semanal de
          ranked.
        </p>
      </div>

      {/* Destacados del periodo + ranking */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-extrabold text-ink">Destacados ({report.periodLabel})</p>
          <Link href="/ranking" className="text-xs font-bold text-ink-soft hover:underline">
            Ranking completo ›
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
              🎁 Donaciones
            </p>
            {topDon.length === 0 ? (
              <p className="text-sm text-ink-soft">Sin datos.</p>
            ) : (
              <ul className="space-y-1">
                {topDon.map((m, i) => (
                  <li key={m.tag} className="flex items-center gap-2 text-sm">
                    <span className="w-4 flex-none font-extrabold text-gold-deep">{i + 1}</span>
                    <Link href={href(m.tag)} className="min-w-0 flex-1 truncate font-bold text-ink hover:underline">
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
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
              ⭐ Guerra
            </p>
            {topWar.length === 0 ? (
              <p className="text-sm text-ink-soft">Sin datos.</p>
            ) : (
              <ul className="space-y-1">
                {topWar.map((m, i) => (
                  <li key={m.tag} className="flex items-center gap-2 text-sm">
                    <span className="w-4 flex-none font-extrabold text-gold-deep">{i + 1}</span>
                    <Link href={href(m.tag)} className="min-w-0 flex-1 truncate font-bold text-ink hover:underline">
                      {m.name}
                    </Link>
                    <span className="font-extrabold tabular-nums text-ink">⭐ {m.warStars}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
