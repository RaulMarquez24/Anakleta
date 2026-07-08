import Link from "next/link";
import { getSeasonWars } from "@/lib/war-history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { ResultBadge, scoreText, seasonLabel, fmtDate } from "@/components/WarBits";

export const dynamic = "force-dynamic";

export default async function LigaPage({
  params,
}: {
  params: Promise<{ season: string }>;
}) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { season } = await params;
  const decoded = decodeURIComponent(season);
  const wars = await getSeasonWars(decoded);

  return (
    <AppShell email={user?.email}>
      <Link href="/guerras" className="mb-3 inline-block text-sm font-bold text-sky hover:underline">
        ← Historial
      </Link>
      <div className="mb-4">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">
          🏆 {seasonLabel(decoded)}
        </h1>
        <p className="text-sm text-ink-soft">Liga de guerra de clanes · {wars.length} rondas</p>
      </div>

      {wars.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-soft">
          No hay rondas para esta temporada.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {wars.map((w) => (
              <li key={w.id}>
                <Link href={`/guerra/${w.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-2/60">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-2 text-sm font-extrabold text-ink-soft">
                    {w.round ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">Ronda {w.round} · vs {w.opponentName ?? "—"}</p>
                    <p className="text-xs text-ink-soft">{fmtDate(w.startTime)} · {scoreText(w)}</p>
                  </div>
                  <ResultBadge war={w} />
                  <span aria-hidden className="text-ink-soft">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
