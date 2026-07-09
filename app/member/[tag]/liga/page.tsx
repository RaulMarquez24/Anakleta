import { notFound } from "next/navigation";
import { getMemberHistory } from "@/lib/history";
import { getLeagueHistory, type LeagueSeason } from "@/lib/league";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const WEEK_S = 604_800; // 7 días en segundos (una temporada de ranked)
const DAY_MS = 86_400_000;

const fmtDay = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(
    new Date(ms),
  );
const fmtDayYear = (ms: number) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(ms));

// "Lun 29 jun – Dom 5 jul 2026" (la semana va de lunes a domingo).
function weekRange(startMs: number): string {
  return `${fmtDay(startMs)} – ${fmtDayYear(startMs + 6 * DAY_MS)}`;
}

type Row =
  | { kind: "current"; startMs: number }
  | { kind: "missing"; startMs: number }
  | { kind: "data"; startMs: number; season: LeagueSeason };

// Construye la línea de tiempo semana a semana desde la semana EN CURSO hacia
// atrás hasta la primera con datos, rellenando huecos (semanas no jugadas que
// el JSON no trae) y marcando la actual como "en curso".
function buildTimeline(seasons: LeagueSeason[]): Row[] {
  if (seasons.length === 0) return [];
  const bySec = new Map(seasons.map((s) => [s.seasonId, s]));
  const anchor = seasons[0].seasonId; // cualquier inicio de semana: fija la "fase"
  const earliest = Math.min(...seasons.map((s) => s.seasonId));
  const nowSec = Math.floor(Date.now() / 1000);
  // Inicio de la semana actual, alineado a la misma fase que las temporadas.
  const currentStart = nowSec - ((nowSec - anchor) % WEEK_S);

  const rows: Row[] = [];
  for (let w = currentStart; w >= earliest; w -= WEEK_S) {
    const s = bySec.get(w);
    if (w === currentStart && !s) rows.push({ kind: "current", startMs: w * 1000 });
    else if (s) rows.push({ kind: "data", startMs: w * 1000, season: s });
    else rows.push({ kind: "missing", startMs: w * 1000 });
  }
  return rows;
}

export default async function MemberLeaguePage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const [history, seasons] = await Promise.all([
    getMemberHistory(decoded),
    getLeagueHistory(decoded),
  ]);
  if (!history) notFound();

  const back = `/member/${encodeURIComponent(decoded)}`;
  const rows = buildTimeline(seasons);

  return (
    <AppShell email={user?.email} title={`Liga · ${history.name}`} back={back}>
      <p className="mb-4 text-sm text-ink-soft">
        Historial semanal de ranked (lunes a domingo): copas, puesto y si cumple sus ataques.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-3xl">🏆</p>
          <p className="mt-2 font-bold text-ink-soft">Sin historial de liga todavía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            // Semana EN CURSO (aún sin cerrar).
            if (r.kind === "current") {
              return (
                <div
                  key={r.startMs}
                  className="rounded-2xl border border-dashed border-gold/50 bg-gold/5 p-3.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-ink">{weekRange(r.startMs)}</p>
                    <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-[11px] font-extrabold text-gold-deep">
                      ⏳ En curso
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">Semana en juego — aún sin cerrar.</p>
                </div>
              );
            }
            // Semana SIN datos (no participó / no la trae el JSON).
            if (r.kind === "missing") {
              return (
                <div
                  key={r.startMs}
                  className="flex items-center justify-between rounded-2xl border border-line bg-surface/60 p-3.5 opacity-70"
                >
                  <p className="font-bold text-ink-soft">{weekRange(r.startMs)}</p>
                  <span className="rounded-full bg-banner/12 px-2.5 py-0.5 text-[11px] font-extrabold text-banner">
                    No participó
                  </span>
                </div>
              );
            }
            // Semana con datos.
            const s = r.season;
            return (
              <div key={r.startMs} className="rounded-2xl border border-line bg-surface p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-extrabold text-ink">{weekRange(r.startMs)}</p>
                  <span className="flex items-center gap-2 text-sm font-extrabold">
                    {s.placement != null && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] text-gold-deep">
                        #{s.placement}
                      </span>
                    )}
                    <span className="text-gold-deep">🏆 {s.trophies}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                  <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">
                    ⚔️ {s.attackWins}/{s.maxBattles} batallas
                  </span>
                  {s.attackWins < s.maxBattles ? (
                    <span className="rounded-lg bg-banner/12 px-2 py-1 text-banner">
                      {s.maxBattles - s.attackWins} sin jugar
                    </span>
                  ) : (
                    <span className="rounded-lg bg-grass/15 px-2 py-1 text-grass">✓ todas</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        &ldquo;X/{"{max}"} batallas&rdquo; = batallas jugadas de las disponibles esa semana (así ves si
        cumple sus ataques). #puesto y 🏆 copas con las que cerró. El ranked va de lunes a domingo: la de
        arriba está en curso y las semanas sin datos salen como &ldquo;no participó&rdquo;.
      </p>
    </AppShell>
  );
}
