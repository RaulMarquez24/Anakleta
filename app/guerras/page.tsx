import Link from "next/link";
import { getNormalWars, getCwlSeasons } from "@/lib/war-history";
import { getCurrentWar } from "@/lib/war";
import { getClanName } from "@/lib/dashboard";
import { listSeasons } from "@/lib/cwl";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { NewLeagueButton } from "@/components/NewLeagueButton";
import { ResultBadge, scoreText, seasonLabel, fmtDate } from "@/components/WarBits";

export const dynamic = "force-dynamic";

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function suggestedSeason(): string {
  const now = new Date();
  const bump = now.getUTCDate() >= 20 ? 1 : 0;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + bump, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function GuerrasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  const [current, wars, seasons, clanName, cwlLists] = await Promise.all([
    getCurrentWar().catch(() => null),
    getNormalWars(),
    getCwlSeasons(),
    getClanName(),
    listSeasons().catch(() => []),
  ]);

  // Ligas = unión de temporadas con datos de guerra + temporadas con inscripción.
  const warBySeason = new Map(seasons.map((s) => [s.season, s]));
  const listBySeason = new Map(cwlLists.map((l) => [l.season, l]));
  const ligaSeasons = Array.from(
    new Set([...seasons.map((s) => s.season), ...cwlLists.map((l) => l.season)]),
  ).sort((a, b) => b.localeCompare(a));

  // "En curso" solo si está en guerra o preparación. Una guerra ya terminada
  // (warEnded, típico entre rondas de CWL) NO es en curso: vive en Ligas.
  const live =
    current &&
    (current.state === "inWar" || current.state === "preparation") &&
    current.members.length > 0
      ? current
      : null;

  // Por defecto abre donde hay contenido (CWL si no hay guerras normales).
  const tab =
    sp.tab === "guerras" || sp.tab === "ligas"
      ? sp.tab
      : wars.length === 0 && ligaSeasons.length > 0
        ? "ligas"
        : "guerras";

  const left = live ? timeLeft(live.endTime) : null;
  const tabCls = (active: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-center text-sm font-extrabold transition ${
      active ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
    }`;

  return (
    <AppShell email={user?.email} title="Guerras">
      {/* En curso (siempre visible, sobre las pestañas) */}
      {live ? (
        <Link
          href="/war"
          className="mb-5 block overflow-hidden rounded-2xl border-2 border-banner/50 bg-banner/10 transition hover:bg-banner/15"
        >
          <div className="flex items-center gap-2 px-4 pt-3.5">
            <span className="flex h-2.5 w-2.5 flex-none animate-pulse rounded-full bg-banner" aria-hidden />
            <span className="text-xs font-extrabold uppercase tracking-wide text-banner">En curso</span>
            <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10px] font-extrabold text-gold-deep">
              {live.isCwl ? `CWL${live.round ? ` · Ronda ${live.round}` : ""}` : "Guerra"}
            </span>
            {left && <span className="ml-auto text-xs font-bold text-ink-soft">quedan {left}</span>}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 pb-3.5 pt-1.5">
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold text-ink">
                {clanName ? `${clanName} vs ${live.opponentName ?? "—"}` : `vs ${live.opponentName ?? "—"}`}
              </p>
              <p className="text-sm font-bold text-ink-soft">
                ⭐ <span className="text-gold-deep">{live.clanStars ?? 0}</span> — {live.opponentStars ?? 0}
              </p>
            </div>
            {live.state === "inWar" && live.pending.length > 0 ? (
              <span className="flex-none rounded-full bg-banner/20 px-3 py-1 text-sm font-extrabold text-banner">
                {live.pending.length} sin atacar
              </span>
            ) : live.state === "preparation" ? (
              <span className="flex-none rounded-full bg-sky/15 px-3 py-1 text-sm font-extrabold text-sky">
                Preparación
              </span>
            ) : (
              <span className="flex-none text-ink-soft">›</span>
            )}
          </div>
        </Link>
      ) : (
        <div className="mb-5 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          🕊️ No hay ninguna guerra en curso ahora mismo.
        </div>
      )}

      {/* Pestañas Guerras | Ligas */}
      <div className="mb-4 flex gap-2">
        <Link href="/guerras?tab=guerras" className={tabCls(tab === "guerras")}>
          ⚔️ Guerras{wars.length > 0 ? ` (${wars.length})` : ""}
        </Link>
        <Link href="/guerras?tab=ligas" className={tabCls(tab === "ligas")}>
          🏆 Ligas{ligaSeasons.length > 0 ? ` (${ligaSeasons.length})` : ""}
        </Link>
      </div>

      {tab === "ligas" ? (
        <div className="space-y-2">
          {/* Abrir la inscripción de una liga (crea su lista y navega a ella) */}
          <NewLeagueButton suggested={suggestedSeason()} />

          {ligaSeasons.length === 0 ? (
            <Empty>Aún no hay ligas. Abre una inscripción arriba o se crean solas durante la CWL.</Empty>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ligaSeasons.map((season) => {
              const s = warBySeason.get(season);
              const l = listBySeason.get(season);
              return (
                <Link
                  key={season}
                  href={`/liga/${encodeURIComponent(season)}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:bg-surface-2/60"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gold/15 text-lg">
                    🏆
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-ink">{seasonLabel(season)}</p>
                    <p className="text-xs text-ink-soft">
                      {s ? `${s.wars} rondas registradas` : "Sin rondas aún"}
                      {l && (
                        <span className={l.state === "open" ? "text-grass" : "text-ink-soft"}>
                          {" · "}
                          {l.state === "open" ? "📋 inscripción abierta" : "📋 inscripción"}
                        </span>
                      )}
                    </p>
                  </div>
                  {s ? (
                    <span className="text-sm font-extrabold tabular-nums">
                      <span className="text-grass">{s.wins}V</span>
                      <span className="text-ink-soft"> · </span>
                      <span className="text-banner">{s.losses}D</span>
                      {s.ties > 0 && <span className="text-ink-soft"> · {s.ties}E</span>}
                    </span>
                  ) : null}
                  <span aria-hidden className="text-ink-soft">›</span>
                </Link>
              );
            })}
            </div>
          )}
        </div>
      ) : wars.length === 0 ? (
        <Empty>
          Aún no hay guerras normales registradas. Se guardan solas cuando el clan entra en guerra
          (fuera de la semana de CWL).
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {wars.map((w) => (
              <li key={w.id}>
                <Link href={`/guerra/${w.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-2/60">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-2 text-lg">
                    ⚔️
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">vs {w.opponentName ?? "—"}</p>
                    <p className="text-xs text-ink-soft">
                      {fmtDate(w.startTime)} · {scoreText(w)}
                    </p>
                  </div>
                  <ResultBadge war={w} />
                  <span aria-hidden className="text-ink-soft">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-center text-sm text-ink-soft">
      {children}
    </div>
  );
}
