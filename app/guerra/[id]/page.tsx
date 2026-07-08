import Link from "next/link";
import { notFound } from "next/navigation";
import { getWarDetail } from "@/lib/war-history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
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
  const attacked = members.filter((m) => m.attacksUsed > 0).length;

  return (
    <AppShell email={user?.email}>
      <Link href={back} className="mb-3 inline-block text-sm font-bold text-sky hover:underline">
        ← Volver
      </Link>

      <div className="mb-4">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">vs {war.opponentName ?? "—"}</h1>
          <ResultBadge war={war} />
        </div>
        <p className="text-sm text-ink-soft">
          {war.isCwl ? `🏆 ${seasonLabel(war.season)} · Ronda ${war.round}` : "⚔️ Guerra"} · {fmtDate(war.startTime)}
        </p>
      </div>

      {/* Marcador */}
      <div className="mb-5 rounded-2xl border border-line bg-surface p-4 text-center">
        <p className="text-2xl font-extrabold text-ink">
          ⭐ {war.clanStars ?? "—"} <span className="text-ink-soft">—</span> {war.opponentStars ?? "—"}
        </p>
        <p className="text-sm text-ink-soft">
          {war.clanDestruction?.toFixed(1) ?? "—"}% vs {war.opponentDestruction?.toFixed(1) ?? "—"}%
        </p>
      </div>

      {/* Alineación */}
      <h2 className="mb-2 flex items-baseline justify-between font-extrabold text-ink">
        <span>Alineación</span>
        {members.length > 0 && (
          <span className="text-xs font-semibold text-ink-soft">{attacked}/{members.length} atacaron</span>
        )}
      </h2>

      {members.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          No se guardó la alineación de esta guerra (guerras anteriores a activar el histórico).
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const nada = m.attacksUsed === 0;
              return (
                <li key={m.tag} className={`flex items-center gap-3 px-3.5 py-2.5 ${nada ? "bg-banner/8" : ""}`}>
                  <span className="w-6 flex-none text-sm font-bold text-ink-soft">{m.mapPosition}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{m.name}</p>
                    <p className="text-xs text-ink-soft">TH{m.townHall}</p>
                  </div>
                  {nada ? (
                    <span className="rounded-full bg-banner/15 px-2.5 py-1 text-xs font-extrabold text-banner">
                      No atacó
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm font-bold text-ink">
                      <span className="text-gold-deep">⭐ {m.stars}</span>
                      <span className="text-ink-soft">{m.attacksUsed}/{attacksPerMember}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
