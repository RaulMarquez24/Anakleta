import Link from "next/link";
import { getNormalWars, getCwlSeasons } from "@/lib/war-history";
import { getCurrentWar } from "@/lib/war";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { ResultBadge, scoreText, seasonLabel, fmtDate } from "@/components/WarBits";

export const dynamic = "force-dynamic";

export default async function GuerrasPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [current, wars, seasons] = await Promise.all([
    getCurrentWar().catch(() => null),
    getNormalWars(),
    getCwlSeasons(),
  ]);

  const live = current && current.state !== "notInWar" && current.members.length > 0 ? current : null;

  return (
    <AppShell email={user?.email} title="Guerras">
      {/* Acceso fijado a lo que esté en curso */}
      {live ? (
        <Link
          href="/war"
          className="mb-6 block rounded-2xl border-2 border-banner/50 bg-banner/10 p-4 transition hover:bg-banner/15"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 flex-none rounded-full bg-banner" aria-hidden />
            <span className="text-xs font-extrabold uppercase tracking-wide text-banner">
              En curso
            </span>
            {live.isCwl && (
              <span className="rounded-full bg-gold/25 px-2 py-0.5 text-[10px] font-extrabold text-gold-deep">
                CWL{live.round ? ` · Ronda ${live.round}` : ""}
              </span>
            )}
          </div>
          <p className="text-lg font-extrabold text-ink">vs {live.opponentName ?? "—"}</p>
          <p className="text-sm text-ink-soft">
            ⭐ {live.clanStars ?? "—"} — {live.opponentStars ?? "—"}
            {live.state === "inWar" && live.pending.length > 0 && (
              <span className="font-bold text-banner"> · {live.pending.length} sin atacar</span>
            )}
            {live.state === "preparation" && <span> · en preparación</span>}
          </p>
        </Link>
      ) : (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          🕊️ No hay ninguna guerra en curso ahora mismo.
        </div>
      )}

      {/* Ligas (CWL) */}
      <h2 className="mb-2 flex items-center gap-2 font-extrabold text-gold-deep">
        <span aria-hidden>🏆</span> Ligas de guerra (CWL)
      </h2>
      {seasons.length === 0 ? (
        <p className="mb-6 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          Aún no hay ligas registradas. Se guardan automáticamente durante la semana de CWL.
        </p>
      ) : (
        <div className="mb-6 space-y-2">
          {seasons.map((s) => (
            <Link
              key={s.season}
              href={`/liga/${encodeURIComponent(s.season)}`}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 hover:bg-surface-2/60"
            >
              <div className="flex-1">
                <p className="font-extrabold text-ink">{seasonLabel(s.season)}</p>
                <p className="text-xs text-ink-soft">{s.wars} rondas registradas</p>
              </div>
              <span className="text-sm font-bold tabular-nums text-ink-soft">
                <span className="text-grass">{s.wins}V</span> · <span className="text-banner">{s.losses}D</span>
                {s.ties > 0 && <> · {s.ties}E</>}
              </span>
              <span aria-hidden className="text-ink-soft">›</span>
            </Link>
          ))}
        </div>
      )}

      {/* Guerras normales */}
      <h2 className="mb-2 flex items-center gap-2 font-extrabold text-ink">
        <span aria-hidden>⚔️</span> Guerras
      </h2>
      {wars.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          Aún no hay guerras normales registradas. Se guardan automáticamente cuando el clan entre en
          guerra (fuera de la semana de CWL).
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {wars.map((w) => (
              <li key={w.id}>
                <Link href={`/guerra/${w.id}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-2/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">vs {w.opponentName ?? "—"}</p>
                    <p className="text-xs text-ink-soft">{fmtDate(w.startTime)} · {scoreText(w)}</p>
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
