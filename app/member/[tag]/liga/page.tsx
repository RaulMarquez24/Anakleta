import { notFound } from "next/navigation";
import { getMemberHistory } from "@/lib/history";
import { getLeagueHistory } from "@/lib/league";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

function weekLabel(ms: number): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(new Date(ms));
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

  return (
    <AppShell email={user?.email} title={`Liga · ${history.name}`} back={back}>
      <p className="mb-4 text-sm text-ink-soft">
        Historial semanal de ranked: copas, puesto y sus ataques por semana.
      </p>

      {seasons.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-3xl">🏆</p>
          <p className="mt-2 font-bold text-ink-soft">Sin historial de liga todavía.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {seasons.map((s) => (
            <div key={s.seasonId} className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-extrabold text-ink">Semana del {weekLabel(s.weekStartMs)}</p>
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
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink-soft">
                  🛡️ {s.defenseStars} ⭐ en contra
                </span>
                {s.attackWins < s.maxBattles && (
                  <span className="rounded-lg bg-banner/12 px-2 py-1 text-banner">
                    {s.maxBattles - s.attackWins} sin jugar
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        &ldquo;X/{"{max}"} batallas&rdquo; = batallas jugadas de las disponibles esa semana (así ves si
        cumple sus ataques). &ldquo;⭐ en contra&rdquo; = estrellas que le hicieron defendiendo. La API
        no expone las estrellas de ataque en este ranked, por eso no se muestran. El ranked se reinicia
        cada semana: una fila por semana.
      </p>
    </AppShell>
  );
}
