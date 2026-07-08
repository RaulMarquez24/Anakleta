import { buildWarNotice, getCurrentWar, type WarView } from "@/lib/war";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { WarNotice } from "./WarNotice";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<WarView["state"], string> = {
  notInWar: "Sin guerra activa",
  preparation: "En preparación",
  inWar: "En guerra",
  warEnded: "Guerra terminada",
};

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
  if (ms <= 0) return "0h 0m";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-ink">{value}</p>
      {sub && <p className="text-sm text-ink-soft">{sub}</p>}
    </div>
  );
}

export default async function WarPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const war = await getCurrentWar();
  const notice = buildWarNotice(war);
  const inWar = war.state === "inWar";
  const showBoard = war.state === "preparation" || inWar || war.state === "warEnded";
  const countdownTarget = war.state === "preparation" ? war.startTime : war.endTime;
  const countdownLabel = war.state === "preparation" ? "Empieza en" : "Termina en";

  return (
    <AppShell email={user?.email}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">Guerra</h1>
        <div className="flex items-center gap-2">
          {war.isCwl && (
            <span className="rounded-full bg-gold/25 px-3 py-1 text-xs font-extrabold text-gold-deep">
              CWL{war.round ? ` · Ronda ${war.round}` : ""}
            </span>
          )}
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-extrabold text-ink-soft">
            {STATE_LABEL[war.state]}
          </span>
        </div>
      </div>

      {war.isPrivate && (
        <div className="rounded-2xl border border-banner/40 bg-banner/10 p-4 text-banner">
          El registro de guerra del clan está en <strong>privado</strong>. Ponlo en público en los
          ajustes del clan (dentro del juego) para ver aquí la guerra actual.
        </div>
      )}

      {war.state === "notInWar" && !war.isPrivate && (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-4xl">🕊️</p>
          <p className="mt-2 font-bold text-ink-soft">Ahora mismo el clan no está en guerra.</p>
        </div>
      )}

      {showBoard && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat
              label="Rival"
              value={war.opponentName ?? "—"}
              sub={war.teamSize ? `${war.teamSize} vs ${war.teamSize}` : undefined}
            />
            <Stat
              label="Marcador"
              value={`⭐ ${war.clanStars ?? "—"} — ${war.opponentStars ?? "—"}`}
              sub={`${war.clanDestruction?.toFixed(1) ?? "—"}% vs ${war.opponentDestruction?.toFixed(1) ?? "—"}%`}
            />
            <Stat
              label={countdownLabel}
              value={timeLeft(countdownTarget) ?? "—"}
              sub={fmtDate(countdownTarget)}
            />
          </div>

          {notice && <WarNotice text={notice} />}

          {inWar && war.pending.length === 0 && (
            <div className="rounded-2xl border border-grass/40 bg-grass/10 p-4 font-bold text-grass">
              ✅ Todos los ataques usados. ¡Nada pendiente!
            </div>
          )}

          {war.members.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <ul className="divide-y divide-line">
                {war.members.map((m) => {
                  const pend = m.attacksPending > 0;
                  return (
                    <li
                      key={m.tag}
                      className={`flex items-center gap-3 px-3.5 py-2.5 ${pend ? "bg-banner/8" : ""}`}
                    >
                      <span className="w-6 flex-none text-sm font-bold text-ink-soft">
                        {m.mapPosition}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-ink">{m.name}</p>
                        <p className="text-xs text-ink-soft">TH{m.townHall}</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-ink">
                        {m.attacksUsed}/{war.attacksPerMember}
                      </span>
                      {pend ? (
                        <span className="rounded-full bg-banner/15 px-2.5 py-1 text-xs font-extrabold text-banner">
                          faltan {m.attacksPending}
                        </span>
                      ) : (
                        <span className="rounded-full bg-grass/15 px-2.5 py-1 text-xs font-extrabold text-grass">
                          hecho
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
