import Link from "next/link";
import { getSeasonWars, getSeasonSummary, type WarSummary } from "@/lib/war-history";
import { getGuildChannels, getGuildMembers, getDefaultChannelId } from "@/lib/discord";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerClient } from "@/lib/supabase/server";
import { getList, getSignups, partition } from "@/lib/cwl";
import { AppShell } from "@/components/AppShell";
import { ResultBadge, scoreText, seasonLabel, fmtDate } from "@/components/WarBits";
import { SendSeasonSummary } from "@/components/SendSeasonSummary";
import { CwlManager, type CwlEntryView } from "@/components/CwlManager";

export const dynamic = "force-dynamic";

const toView = (e: Awaited<ReturnType<typeof getSignups>>[number]): CwlEntryView => ({
  id: e.id,
  name: e.name,
  townHall: e.townHall,
  discordId: e.discord_id,
  source: e.source,
  addedBy: e.added_by,
});

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
  const [wars, summary, channels, defaultChannel, list, discordMembers] = await Promise.all([
    getSeasonWars(decoded),
    getSeasonSummary(decoded),
    getGuildChannels().catch(() => []),
    getDefaultChannelId().catch(() => null),
    getList(decoded),
    getGuildMembers().catch(() => []),
  ]);

  // Miembros activos del clan (para "añadir a mano").
  const svc = createServerClient();
  const { data: members } = await svc
    .from("members")
    .select("tag, name, town_hall, discord_id")
    .eq("is_active", true)
    .order("name");
  const clanMembers = (members ?? []).map((m) => ({
    tag: m.tag as string,
    name: m.name as string,
    townHall: (m.town_hall as number | null) ?? null,
    discordId: (m.discord_id as string | null) ?? null,
  }));

  // Partición de la inscripción (si existe la lista de esta liga).
  let inside: CwlEntryView[] = [];
  let queue: CwlEntryView[] = [];
  let hiddenNames: string[] = [];
  let cutoff: number | null = null;
  if (list) {
    const part = partition(list, await getSignups(decoded));
    inside = part.inside.map(toView);
    queue = part.queue.map(toView);
    hiddenNames = part.hidden.map((e) => e.name);
    cutoff = part.cutoff;
  }

  const byRound = new Map<number, WarSummary>();
  for (const w of wars) if (w.round != null) byRound.set(w.round, w);
  const days = Array.from({ length: summary.expectedRounds }, (_, i) => i + 1);

  return (
    <AppShell email={user?.email} title={`🏆 ${seasonLabel(decoded)}`} back="/guerras?tab=ligas">
      {/* Inscripción de esta liga */}
      <div className="mb-6">
        <CwlManager
          season={decoded}
          exists={Boolean(list)}
          state={list?.state ?? null}
          size={list?.size ?? null}
          cutoff={cutoff}
          closeDate={list?.starts_at ?? null}
          opensAt={list?.opens_at ?? null}
          endsAt={list?.ends_at ?? null}
          inside={inside}
          queue={queue}
          hiddenNames={hiddenNames}
          clanMembers={clanMembers}
          discordMembers={discordMembers}
        />
      </div>

      {/* Participación (rondas + resumen) */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-extrabold text-ink">Participación</h2>
        <p className="text-sm font-semibold text-ink-soft">
          <span className="text-grass">{summary.wins}V</span> · <span className="text-banner">{summary.losses}D</span>
          {summary.ties > 0 && <> · {summary.ties}E</>} · {summary.totalRounds}/{summary.expectedRounds}
        </p>
      </div>

      {summary.totalRounds > 0 && (
        <div className="mb-6">
          <SendSeasonSummary season={decoded} channels={channels} defaultChannelId={defaultChannel} />
        </div>
      )}

      {/* Los días (rondas). Las que faltan salen bloqueadas. */}
      {summary.totalRounds === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          Aún no hay rondas jugadas en esta liga. Aparecerán solas durante la semana de CWL.
        </p>
      ) : (
        <>
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
        </>
      )}
    </AppShell>
  );
}
