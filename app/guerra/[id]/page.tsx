import Link from "next/link";
import { notFound } from "next/navigation";
import { getWarDetail } from "@/lib/war-history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { WarDetail } from "@/components/WarDetail";
import { ResultBadge, seasonLabel, fmtDate } from "@/components/WarBits";

export const dynamic = "force-dynamic";

export default async function GuerraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { id } = await params;
  const detail = await getWarDetail(Number(id));
  if (!detail) notFound();
  const { war, members } = detail;

  const attacksPerMember = war.isCwl ? 1 : 2;
  const back = war.isCwl && war.season ? `/liga/${encodeURIComponent(war.season)}` : "/guerras";

  return (
    <AppShell email={user?.email} title={war.isCwl ? `Ronda ${war.round}` : "Guerra"}>
      <Link href={back} className="mb-3 inline-block text-sm font-bold text-sky hover:underline">
        ← Volver
      </Link>

      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">vs {war.opponentName ?? "—"}</h1>
          <ResultBadge war={war} />
        </div>
        <p className="text-sm text-ink-soft">
          {war.isCwl ? `🏆 ${seasonLabel(war.season)} · Ronda ${war.round}` : "⚔️ Guerra"} ·{" "}
          {fmtDate(war.startTime)}
        </p>
      </div>

      <WarDetail
        war={{
          state: war.state ?? "warEnded",
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
          attacksPerMember,
        }}
        members={members.map((m) => ({
          tag: m.tag,
          name: m.name,
          mapPosition: m.mapPosition,
          townHall: m.townHall,
          attacksUsed: m.attacksUsed,
          attacksPending: Math.max(0, attacksPerMember - m.attacksUsed),
          stars: m.stars,
          destruction: m.destruction,
        }))}
      />

      {members.length === 0 && (
        <p className="mt-3 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          No se guardó la alineación de esta guerra (anterior a activar el histórico).
        </p>
      )}
    </AppShell>
  );
}
