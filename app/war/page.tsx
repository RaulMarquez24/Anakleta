import Link from "next/link";
import { getCurrentWar, type WarView } from "@/lib/war";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
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
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const war = await getCurrentWar();
  const showDetail = war.state !== "notInWar" && war.members.length > 0;

  return (
    <AppShell email={user?.email}>
      <Link href="/guerras" className="mb-3 inline-block text-sm font-bold text-sky hover:underline">
        ← Guerras
      </Link>

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
        />
      )}
    </AppShell>
  );
}
