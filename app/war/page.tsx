import { after } from "next/server";
import { getCurrentWarFresh, type WarView } from "@/lib/war";
import { captureCurrentWarOnView } from "@/lib/war-capture";
import { getWarHelpOverrides } from "@/lib/war-overrides";
import { getClanName } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { WarDetail } from "@/components/WarDetail";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<WarView["state"], string> = {
  notInWar: "Sin guerra activa",
  preparation: "En preparación",
  inWar: "En guerra",
  warEnded: "Guerra terminada",
};

export default async function WarPage() {
  const [user, war, clanName] = await Promise.all([
    getCurrentUser(),
    getCurrentWarFresh(), // en vivo: al consultar la guerra, datos al día (sin caché)
    getClanName(),
  ]);
  const showDetail = war.state !== "notInWar" && war.members.length > 0;

  // Si alguien abre la guerra, la capturamos en ese momento (tras responder, sin
  // bloquear el render y con throttle). Así queda registrada con datos frescos
  // aunque no haya tocado el cron horario todavía.
  if (war.state !== "notInWar" && !war.isPrivate) {
    after(async () => {
      try {
        await captureCurrentWarOnView();
      } catch {
        /* la captura al abrir es best-effort; no afecta a la vista */
      }
    });
  }

  // Correcciones manuales del 2º ataque, solo para guerra normal en curso.
  const warKey = !war.isCwl && war.state === "inWar" ? (war.startTime ?? "") : "";
  const helpOverrides = warKey ? await getWarHelpOverrides(warKey) : {};

  return (
    <AppShell email={user?.email} title="Guerra" back="/guerras">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {war.isCwl && (
          <span className="rounded-full bg-gold/25 px-3 py-1 text-xs font-extrabold text-gold-deep">
            CWL{war.round ? ` · Ronda ${war.round}` : ""}
          </span>
        )}
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-extrabold text-ink-soft">
          {STATE_LABEL[war.state]}
        </span>
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

      {showDetail && (
        <WarDetail
          war={{
            state: war.state,
            isCwl: war.isCwl,
            round: war.round,
            teamSize: war.teamSize,
            opponentName: war.opponentName,
            clanStars: war.clanStars,
            opponentStars: war.opponentStars,
            clanDestruction: war.clanDestruction,
            opponentDestruction: war.opponentDestruction,
            startTime: war.startTime,
            endTime: war.endTime,
            attacksPerMember: war.attacksPerMember,
            warCompleted: war.warCompleted,
          }}
          members={war.members}
          opponentMembers={war.opponentMembers.map((o) => ({
            mapPosition: o.mapPosition,
            townHall: o.townHall,
            starsTaken: o.starsTaken,
          }))}
          clanName={clanName}
          warKey={warKey || undefined}
          helpOverrides={helpOverrides}
          notify={war.state === "inWar"}
          inspect={
            war.opponentTag
              ? {
                  href: `/inspeccionar/clan/${encodeURIComponent(war.opponentTag)}`,
                  badgeUrl: war.opponentBadgeUrl,
                  name: war.opponentName,
                }
              : undefined
          }
        />
      )}
    </AppShell>
  );
}
