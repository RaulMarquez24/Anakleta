import Link from "next/link";
import { buildWarNotice, getCurrentWar, type WarView } from "@/lib/war";
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

// Tiempo restante hasta `iso`, en formato "Xh Ym". El cálculo del "ahora" se hace
// en el render del servidor; es informativo (no cuenta atrás en vivo).
function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "0h 0m";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default async function WarPage() {
  const war = await getCurrentWar();
  const notice = buildWarNotice(war);
  const inWar = war.state === "inWar";
  const countdownTarget = war.state === "preparation" ? war.startTime : war.endTime;
  const countdownLabel = war.state === "preparation" ? "Empieza en" : "Termina en";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Guerra</h1>
            <p className="text-sm text-slate-400">{STATE_LABEL[war.state]}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            ← Miembros
          </Link>
        </header>

        {war.isPrivate && (
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 p-4 text-amber-200">
            El registro de guerra del clan está en <strong>privado</strong>. Ponlo en público
            en los ajustes del clan (dentro del juego) para ver aquí la guerra actual.
          </div>
        )}

        {war.state === "notInWar" && !war.isPrivate && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            Ahora mismo el clan no está en guerra.
          </div>
        )}

        {(war.state === "preparation" || inWar || war.state === "warEnded") && (
          <div className="space-y-6">
            {/* Marcador */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Rival</p>
                <p className="mt-1 text-lg font-semibold">{war.opponentName ?? "—"}</p>
                {war.teamSize && (
                  <p className="text-sm text-slate-400">{war.teamSize} vs {war.teamSize}</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Marcador</p>
                <p className="mt-1 text-lg font-semibold">
                  ⭐ {war.clanStars ?? "—"} — {war.opponentStars ?? "—"}
                </p>
                <p className="text-sm text-slate-400">
                  {war.clanDestruction?.toFixed(1) ?? "—"}% vs{" "}
                  {war.opponentDestruction?.toFixed(1) ?? "—"}%
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{countdownLabel}</p>
                <p className="mt-1 text-lg font-semibold">{timeLeft(countdownTarget) ?? "—"}</p>
                <p className="text-sm text-slate-400">{fmtDate(countdownTarget)}</p>
              </div>
            </div>

            {/* Aviso copiable (solo si hay pendientes en guerra) */}
            {notice && <WarNotice text={notice} />}

            {inWar && war.pending.length === 0 && (
              <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 text-emerald-300">
                ✅ Todos los ataques usados. ¡Nada pendiente!
              </div>
            )}

            {/* Tabla de miembros de la guerra */}
            {war.members.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900 text-left text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Pos</th>
                      <th className="px-3 py-2 font-medium">Miembro</th>
                      <th className="px-3 py-2 text-center font-medium">TH</th>
                      <th className="px-3 py-2 text-center font-medium">Ataques</th>
                      <th className="px-3 py-2 text-center font-medium">Pendientes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {war.members.map((m) => (
                      <tr
                        key={m.tag}
                        className={m.attacksPending > 0 ? "bg-amber-950/20" : ""}
                      >
                        <td className="px-3 py-2 text-slate-500">{m.mapPosition}</td>
                        <td className="px-3 py-2 font-medium">{m.name}</td>
                        <td className="px-3 py-2 text-center text-slate-300">{m.townHall}</td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          {m.attacksUsed}/{war.attacksPerMember}
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums">
                          {m.attacksPending > 0 ? (
                            <span className="text-amber-400">{m.attacksPending}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
