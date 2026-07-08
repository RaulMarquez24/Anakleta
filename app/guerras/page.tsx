import Link from "next/link";
import { getNormalWars, getCwlSeasons } from "@/lib/war-history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { ResultBadge, scoreText, seasonLabel, fmtDate } from "@/components/WarBits";

export const dynamic = "force-dynamic";

export default async function GuerrasPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [wars, seasons] = await Promise.all([getNormalWars(), getCwlSeasons()]);

  return (
    <AppShell email={user?.email}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">Historial</h1>
        <Link href="/war" className="text-sm font-bold text-sky hover:underline">
          Guerra actual →
        </Link>
      </div>

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
