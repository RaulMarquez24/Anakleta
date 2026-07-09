import { buildNoticeText } from "@/lib/war";
import { WarNotice } from "@/app/war/WarNotice";
import { fmtDate } from "@/components/WarBits";

export interface UnifiedWarMember {
  tag: string;
  name: string;
  mapPosition: number;
  townHall: number;
  attacksUsed: number;
  attacksPending: number;
  stars: number;
  destruction: number;
  attacks?: { stars: number; destruction: number; order: number }[];
}

// "⭐⭐⭐" según estrellas (0-3).
function starGlyphs(n: number): string {
  return "★★★".slice(0, n).padEnd(3, "☆");
}
export interface UnifiedWar {
  state: string;
  isCwl: boolean;
  round: number | null;
  teamSize: number | null;
  opponentName: string | null;
  clanStars: number | null;
  opponentStars: number | null;
  clanDestruction: number | null;
  opponentDestruction: number | null;
  startTime: string | null;
  endTime: string | null;
  attacksPerMember: number;
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "0h 0m";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-ink">{value}</p>
      {sub && <p className="text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

export function WarDetail({ war, members }: { war: UnifiedWar; members: UnifiedWarMember[] }) {
  const inWar = war.state === "inWar";
  const prep = war.state === "preparation";
  const pending = members.filter((m) => m.attacksPending > 0);
  const attacked = members.filter((m) => m.attacksUsed > 0).length;

  const noticeText =
    inWar && pending.length > 0
      ? buildNoticeText({
          opponentName: war.opponentName,
          isCwl: war.isCwl,
          round: war.round,
          pending: pending.map((m) => ({ name: m.name, attacksPending: m.attacksPending })),
        })
      : "";

  const timeCard = prep
    ? { label: "Empieza en", value: timeLeft(war.startTime) ?? "—", sub: fmtDate(war.startTime) }
    : inWar
      ? { label: "Termina en", value: timeLeft(war.endTime) ?? "—", sub: fmtDate(war.endTime) }
      : { label: "Terminó", value: fmtDate(war.endTime), sub: undefined };

  return (
    <div className="space-y-4">
      {/* Marcador */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card
          label="Rival"
          value={war.opponentName ?? "—"}
          sub={war.teamSize ? `${war.teamSize} vs ${war.teamSize}` : undefined}
        />
        <Card
          label="Marcador"
          value={`⭐ ${war.clanStars ?? "—"} — ${war.opponentStars ?? "—"}`}
          sub={`${war.clanDestruction?.toFixed(1) ?? "—"}% vs ${war.opponentDestruction?.toFixed(1) ?? "—"}%`}
        />
        <Card label={timeCard.label} value={timeCard.value} sub={timeCard.sub} />
      </div>

      {/* Aviso copiable (solo en guerra con pendientes) */}
      {noticeText && <WarNotice text={noticeText} />}
      {inWar && pending.length === 0 && members.length > 0 && (
        <div className="rounded-2xl border border-grass/40 bg-grass/10 p-4 font-bold text-grass">
          ✅ Todos los ataques usados. ¡Nada pendiente!
        </div>
      )}

      {/* Alineación con detalle por jugador */}
      {members.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-baseline justify-between font-extrabold text-ink">
            <span>Alineación</span>
            <span className="text-xs font-semibold text-ink-soft">
              {attacked}/{members.length} atacaron
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {members.map((m) => {
                const nada = m.attacksUsed === 0;
                const highlight = nada ? "bg-banner/8" : m.attacksPending > 0 ? "bg-gold/10" : "";
                return (
                  <li key={m.tag} className={`flex items-center gap-3 px-3.5 py-2.5 ${highlight}`}>
                    <span className="w-6 flex-none text-sm font-bold text-ink-soft">{m.mapPosition}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">{m.name}</p>
                      <p className="text-xs text-ink-soft">TH{m.townHall}</p>
                      {m.attacks && m.attacks.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.attacks.map((a, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold"
                              title={`Ataque ${a.order}`}
                            >
                              <span className="text-gold-deep">{starGlyphs(a.stars)}</span>
                              <span className="tabular-nums text-ink-soft">{Math.round(a.destruction)}%</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {m.attacksUsed > 0 && (
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <span className="text-gold-deep">⭐ {m.stars}</span>
                        <span className="tabular-nums text-ink-soft">
                          {m.attacksUsed}/{war.attacksPerMember}
                        </span>
                      </span>
                    )}
                    {nada ? (
                      inWar || prep ? (
                        <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-extrabold text-gold-deep">
                          pendiente
                        </span>
                      ) : (
                        <span className="rounded-full bg-banner/15 px-2.5 py-1 text-xs font-extrabold text-banner">
                          No atacó
                        </span>
                      )
                    ) : (
                      m.attacksPending > 0 && (
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-extrabold text-gold-deep">
                          faltan {m.attacksPending}
                        </span>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
