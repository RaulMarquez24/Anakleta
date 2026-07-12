import Link from "next/link";
import { fmtDate } from "@/components/WarBits";
import { NotifyDiscordButton } from "@/components/NotifyDiscordButton";
import { HelpToggleList } from "@/components/HelpToggleList";

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
  reachableHelp?: boolean; // (en vivo) el 2º ayudaría: hay base a su alcance sin 3⭐
}
export interface OpponentBase {
  mapPosition: number;
  townHall: number;
  starsTaken: number;
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
  warCompleted?: boolean; // (en vivo) todas las bases rivales al 3⭐
}

// "★★★" según estrellas (0-3), con las que faltan en hueco.
function starGlyphs(n: number): string {
  return "★★★".slice(0, n).padEnd(3, "☆");
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "0h 0m";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function WarDetail({
  war,
  members,
  clanName,
  inspect,
  notify = false,
  opponentMembers,
  warKey,
  helpOverrides,
}: {
  war: UnifiedWar;
  members: UnifiedWarMember[];
  clanName?: string | null;
  inspect?: { href: string; badgeUrl: string | null; name: string | null };
  notify?: boolean; // muestra el botón "Avisar en Discord" (solo guerra en vivo)
  opponentMembers?: OpponentBase[]; // (en vivo) bases rivales, para "quedan por rematar"
  warKey?: string; // (en vivo) clave de la guerra para las correcciones del 2º
  helpOverrides?: Record<string, boolean>; // correcciones manuales del 2º ataque
}) {
  const inWar = war.state === "inWar";
  const prep = war.state === "preparation";
  const attacked = members.filter((m) => m.attacksUsed > 0).length;

  // 1er ataque = obligatorio (no lo hizo). El 2º es AYUDA, nunca "negativo".
  const obligatorio = members.filter((m) => m.attacksUsed === 0);
  // Miembros con el 2º libre (guerra no rematada): la lista de "pueden ayudar".
  const segundos = war.warCompleted
    ? []
    : members.filter((m) => m.attacksUsed >= 1 && m.attacksPending > 0);
  // Bases rivales que faltan por rematar (solo en vivo).
  const restantes = (opponentMembers ?? [])
    .filter((o) => o.starsTaken < 3)
    .sort((a, b) => a.mapPosition - b.mapPosition);

  const cs = war.clanStars ?? 0;
  const os = war.opponentStars ?? 0;
  const cd = war.clanDestruction ?? 0;
  const od = war.opponentDestruction ?? 0;
  const winning = cs > os || (cs === os && cd > od);
  const tied = cs === os && cd === od;

  // Pastilla de estado (marcador): en guerra = cómo vas; terminada = resultado.
  const statePill = prep
    ? { text: "Preparación", cls: "bg-sky/15 text-sky" }
    : tied
      ? { text: inWar ? "Empate" : "Empate", cls: "bg-surface-2 text-ink-soft" }
      : winning
        ? { text: inWar ? "Vas ganando" : "Victoria", cls: "bg-grass/15 text-grass" }
        : { text: inWar ? "Vas perdiendo" : "Derrota", cls: "bg-banner/15 text-banner" };

  const time = prep
    ? { label: "Empieza en", value: timeLeft(war.startTime) ?? fmtDate(war.startTime) }
    : inWar
      ? { label: "Termina en", value: timeLeft(war.endTime) ?? "—" }
      : { label: "Terminó", value: fmtDate(war.endTime) };

  return (
    <div className="space-y-4">
      {/* Marcador compacto */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="p-4 text-center">
            <p className="mb-1 truncate text-[10px] font-extrabold uppercase tracking-wide text-gold-deep">
              {clanName ?? "Nosotros"}
            </p>
            <p className="text-3xl font-extrabold leading-none text-gold-deep">⭐ {cs}</p>
            <p className="mt-1 text-xs font-semibold text-ink-soft">{cd.toFixed(1)}%</p>
          </div>
          <div className="flex flex-col items-center px-1 text-ink-soft">
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {war.teamSize ? `${war.teamSize} v ${war.teamSize}` : "—"}
            </span>
            <span className="text-lg font-extrabold">–</span>
          </div>
          <div className="p-4 text-center">
            <p className="mb-1 truncate text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
              {war.opponentName ?? "Rival"}
            </p>
            <p className="text-3xl font-extrabold leading-none text-ink">⭐ {os}</p>
            <p className="mt-1 text-xs font-semibold text-ink-soft">{od.toFixed(1)}%</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${statePill.cls}`}>
            {statePill.text}
          </span>
          <span className="text-sm">
            <span className="text-ink-soft">{time.label} </span>
            <span className="font-extrabold text-ink">{time.value}</span>
          </span>
        </div>
      </div>

      {/* Ataques pendientes (solo mientras hay guerra). El 1º es obligatorio; el
          2º es ayuda opcional y no cuenta como falta. */}
      {(inWar || prep) && (
        <>
          {obligatorio.length === 0 ? (
            <div className="rounded-2xl border border-grass/40 bg-grass/10 p-4 text-center font-bold text-grass">
              ✅ Todos han hecho su ataque obligatorio
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="rounded-full bg-banner/15 px-2.5 py-0.5 text-xs font-extrabold text-banner">
                  {obligatorio.length}
                </span>
                <h2 className="font-extrabold text-ink">
                  Faltan por atacar{war.isCwl ? "" : " (obligatorio)"}
                </h2>
              </div>
              <ul className="space-y-2">
                {obligatorio.map((m) => (
                  <li key={m.tag} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-bold text-ink">
                      {m.name} <span className="text-xs font-semibold text-ink-soft">TH{m.townHall}</span>
                    </span>
                    <span className="flex-none text-xs font-extrabold text-banner">
                      {war.isCwl ? "sin atacar" : "1er ataque"}
                    </span>
                  </li>
                ))}
              </ul>
              {notify && inWar && <NotifyDiscordButton />}
            </div>
          )}

          {/* Pueden ayudar con el 2º (opcional): sugerido por TH + corrección manual */}
          {warKey && segundos.length > 0 && (
            <HelpToggleList
              warKey={warKey}
              members={segundos.map((m) => ({
                tag: m.tag,
                name: m.name,
                townHall: m.townHall,
                reachableHelp: !!m.reachableHelp,
              }))}
              initialOverrides={helpOverrides ?? {}}
            />
          )}

          {/* Quedan por rematar (bases rivales sin 3⭐) */}
          {inWar && restantes.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="mb-2 font-extrabold text-ink">Quedan por rematar ({restantes.length})</h2>
              <ul className="flex flex-wrap gap-1.5">
                {restantes.map((o) => (
                  <li
                    key={o.mapPosition}
                    className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink"
                  >
                    #{o.mapPosition} · TH{o.townHall} · {o.starsTaken}⭐
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Inspeccionar el clan rival en tiempo real (no se guarda) */}
      {inspect && (
        <Link
          href={inspect.href}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
        >
          {inspect.badgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inspect.badgeUrl} alt="" width={36} height={36} className="h-9 w-9 flex-none" />
          ) : (
            <span className="text-xl">🔍</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-ink">Inspeccionar clan rival</span>
            <span className="block truncate text-xs text-ink-soft">
              {inspect.name ?? "Rival"} · perfil y miembros en vivo
            </span>
          </span>
          <span aria-hidden className="text-ink-soft">›</span>
        </Link>
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
                const canHelp = m.attacksPending > 0 && !!m.reachableHelp && !war.warCompleted;
                const highlight = nada ? "bg-banner/8" : canHelp ? "bg-gold/10" : "";
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
                      canHelp &&
                      (inWar || prep) && (
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-extrabold text-gold-deep">
                          puede ayudar
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
