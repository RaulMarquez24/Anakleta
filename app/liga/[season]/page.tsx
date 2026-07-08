import Link from "next/link";
import { getSeasonWars, getSeasonSummary, type WarSummary } from "@/lib/war-history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { ResultBadge, scoreText, seasonLabel, fmtDate } from "@/components/WarBits";

export const dynamic = "force-dynamic";

export default async function LigaPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { season } = await params;
  const decoded = decodeURIComponent(season);
  const [wars, summary] = await Promise.all([getSeasonWars(decoded), getSeasonSummary(decoded)]);

  const byRound = new Map<number, WarSummary>();
  for (const w of wars) if (w.round != null) byRound.set(w.round, w);
  const days = Array.from({ length: summary.expectedRounds }, (_, i) => i + 1);

  return (
    <AppShell email={user?.email} title={`🏆 ${seasonLabel(decoded)}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/guerras" className="text-sm font-bold text-sky hover:underline">
          ← Guerras
        </Link>
        <p className="text-sm text-ink-soft">
          <span className="text-grass">{summary.wins}V</span> · <span className="text-banner">{summary.losses}D</span>
          {summary.ties > 0 && <> · {summary.ties}E</>} · {summary.totalRounds}/{summary.expectedRounds}
        </p>
      </div>

      {/* Los 7 días (rondas). Las que faltan salen bloqueadas. */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {days.map((round) => {
            const w = byRound.get(round);
            if (!w) {
              return (
                <li key={round} className="flex items-center gap-3 px-3.5 py-3 opacity-60">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-2 text-sm font-extrabold text-ink-soft">
                    {round}
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-ink-soft">Ronda {round}</p>
                    <p className="text-xs text-ink-soft">Pendiente</p>
                  </div>
                  <span aria-hidden className="text-ink-soft">🔒</span>
                </li>
              );
            }
            return (
              <li key={round}>
                <Link href={`/guerra/${w.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-2/60">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-2 text-sm font-extrabold text-ink-soft">
                    {round}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">Ronda {round} · vs {w.opponentName ?? "—"}</p>
                    <p className="text-xs text-ink-soft">{fmtDate(w.startTime)} · {scoreText(w)}</p>
                  </div>
                  <ResultBadge war={w} />
                  <span aria-hidden className="text-ink-soft">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Resumen de la liga: rendimiento por miembro */}
      <h2 className="mb-2 font-extrabold text-ink">Resumen de la liga</h2>
      {summary.members.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          Aún no hay datos de alineación en esta temporada.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-bold">#</th>
                <th className="px-3 py-2 font-bold">Miembro</th>
                <th className="px-3 py-2 text-right font-bold">⭐</th>
                <th className="px-3 py-2 text-right font-bold">Ataques</th>
                <th className="px-3 py-2 text-right font-bold">Sin atacar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {summary.members.map((m, i) => (
                <tr key={m.tag} className={m.missed > 0 ? "bg-banner/8" : ""}>
                  <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
                  <td className="px-3 py-2 font-bold text-ink">{m.name}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-gold-deep">{m.stars}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {m.attacksUsed}/{m.roundsPlayed}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.missed > 0 ? (
                      <span className="font-bold text-banner">{m.missed}</span>
                    ) : (
                      <span className="text-ink-soft">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        Ordenado por estrellas conseguidas en toda la liga. &ldquo;Ataques&rdquo; = usados/rondas
        alineado; &ldquo;Sin atacar&rdquo; = rondas en las que estaba alineado y no atacó.
      </p>
    </AppShell>
  );
}
