import Link from "next/link";
import { getCurrentWar, type WarView } from "@/lib/war";
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
    getCurrentWar(),
    getClanName(),
  ]);
  const showDetail = war.state !== "notInWar" && war.members.length > 0;

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
          }}
          members={war.members}
          clanName={clanName}
        />
      )}

      {/* Inspeccionar el clan rival en tiempo real (no se guarda) */}
      {showDetail && war.opponentTag && (
        <Link
          href={`/inspeccionar/${encodeURIComponent(war.opponentTag)}`}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
        >
          {war.opponentBadgeUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={war.opponentBadgeUrl} alt="" width={36} height={36} className="h-9 w-9 flex-none" />
          ) : (
            <span className="text-xl">🔍</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-ink">Inspeccionar clan rival</span>
            <span className="block truncate text-xs text-ink-soft">
              {war.opponentName ?? "Rival"} · perfil y miembros en vivo
            </span>
          </span>
          <span aria-hidden className="text-ink-soft">›</span>
        </Link>
      )}
    </AppShell>
  );
}
