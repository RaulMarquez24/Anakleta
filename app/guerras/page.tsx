import Link from "next/link";
import { getNormalWars, getCwlSeasons } from "@/lib/war-history";
import { getCurrentWar } from "@/lib/war";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
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

export default async function GuerrasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  const [current, wars, seasons] = await Promise.all([
    getCurrentWar().catch(() => null),
    getNormalWars(),
    getCwlSeasons(),
  ]);

  const live = current && current.state !== "notInWar" && current.members.length > 0 ? current : null;

  // Por defecto abre donde hay contenido (CWL si no hay guerras normales).
  const tab =
    sp.tab === "guerras" || sp.tab === "ligas"
      ? sp.tab
      : wars.length === 0 && seasons.length > 0
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
              <p className="truncate text-lg font-extrabold text-ink">vs {live.opponentName ?? "—"}</p>
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
          🏆 Ligas{seasons.length > 0 ? ` (${seasons.length})` : ""}
        </Link>
      </div>

      {tab === "ligas" ? (
        seasons.length === 0 ? (
          <Empty>
            Aún no hay ligas registradas. Se guardan solas durante la semana de CWL.
          </Empty>
        ) : (
          <div className="space-y-2">
            {seasons.map((s) => (
              <Link
                key={s.season}
                href={`/liga/${encodeURIComponent(s.season)}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:bg-surface-2/60"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gold/15 text-lg">
                  🏆
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-ink">{seasonLabel(s.season)}</p>
                  <p className="text-xs text-ink-soft">{s.wars} rondas registradas</p>
                </div>
                <span className="text-sm font-extrabold tabular-nums">
                  <span className="text-grass">{s.wins}V</span>
                  <span className="text-ink-soft"> · </span>
                  <span className="text-banner">{s.losses}D</span>
                  {s.ties > 0 && <span className="text-ink-soft"> · {s.ties}E</span>}
                </span>
                <span aria-hidden className="text-ink-soft">›</span>
              </Link>
            ))}
          </div>
        )
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
