import Link from "next/link";
import Image from "next/image";
import { getMembersOverview } from "@/lib/dashboard";
import { getActivityReport } from "@/lib/history";
import { getCurrentWar } from "@/lib/war";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

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
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default async function ClanHomePage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [data, report, war] = await Promise.all([
    getMembersOverview(),
    getActivityReport("semana"),
    getCurrentWar().catch(() => null),
  ]);

  const members = report.members;
  const cats = {
    expulsar: members.filter((m) => m.category === "expulsion").length,
    revisar: members.filter((m) => m.category === "revisar").length,
    destacables: members.filter((m) => m.category === "destacado").length,
  };
  const topDon = [...members]
    .filter((m) => (m.donations ?? 0) > 0)
    .sort((a, b) => (b.donations ?? 0) - (a.donations ?? 0))
    .slice(0, 3);
  const topWar = [...members]
    .filter((m) => m.warStars > 0)
    .sort((a, b) => b.warStars - a.warStars)
    .slice(0, 3);

  const inWar = war && (war.state === "inWar" || war.state === "preparation");
  const left = timeLeft(war?.endTime ?? null);

  return (
    <AppShell email={user?.email} title="Clan">
      {/* Identidad del clan */}
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <Image
          src="/logo.jpg"
          alt=""
          aria-hidden
          width={56}
          height={56}
          className="h-14 w-14 flex-none rounded-2xl shadow-[0_0_0_2px_var(--gold)]"
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-extrabold text-ink">{data.clanName ?? "Añakleta"}</p>
          <p className="text-xs font-semibold text-ink-soft">
            {data.members.length} miembros
            {data.clanLevel != null && <> · nivel {data.clanLevel}</>}
          </p>
          <p className="text-[11px] text-ink-soft">Última captura: {fmtDate(data.latestCapture)}</p>
        </div>
      </div>

      {/* Estado de guerra / CWL */}
      <Link
        href="/guerras"
        className="mb-4 block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        {inWar ? (
          <>
            <div className="flex items-center justify-between">
              <p className="font-extrabold text-ink">
                {war!.isCwl ? `🏆 Liga de Clanes · Ronda ${war!.round ?? "—"}` : "⚔️ En guerra"}
              </p>
              <span className="text-ink-soft">›</span>
            </div>
            <p className="mt-1 text-sm font-bold text-ink-soft">
              vs {war!.opponentName ?? "—"}
              {war!.state === "preparation" ? (
                <span className="ml-2 rounded-full bg-sky/15 px-2 py-0.5 text-[11px] font-extrabold text-sky">
                  Preparación
                </span>
              ) : (
                <>
                  {" · "}
                  <span className="font-extrabold text-ink">
                    {war!.clanStars ?? 0}–{war!.opponentStars ?? 0} ⭐
                  </span>
                  {left && <> · quedan {left}</>}
                </>
              )}
            </p>
            {war!.state === "inWar" && war!.pending.length > 0 && (
              <p className="mt-1 text-xs font-bold text-banner">
                {war!.pending.length} sin atacar
              </p>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink-soft">🕊️ Sin guerra ahora mismo</p>
            <span className="text-ink-soft">›</span>
          </div>
        )}
      </Link>

      {/* Gestión rápida */}
      <Link
        href="/actividad"
        className="mb-4 block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="font-extrabold text-ink">Gestión de esta semana</p>
          <span className="text-ink-soft">›</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-gold/12 py-2">
            <p className="text-2xl font-extrabold text-gold-deep">{cats.revisar}</p>
            <p className="text-[11px] font-bold text-ink-soft">🟡 A revisar</p>
          </div>
          <div className="rounded-xl bg-banner/12 py-2">
            <p className="text-2xl font-extrabold text-banner">{cats.expulsar}</p>
            <p className="text-[11px] font-bold text-ink-soft">🔴 A echar</p>
          </div>
          <div className="rounded-xl bg-grass/12 py-2">
            <p className="text-2xl font-extrabold text-grass">{cats.destacables}</p>
            <p className="text-[11px] font-bold text-ink-soft">🟢 Destacables</p>
          </div>
        </div>
      </Link>

      {/* Destacados */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-extrabold text-ink">Destacados de la semana</p>
          <Link href="/ranking" className="text-xs font-bold text-ink-soft hover:underline">
            Ranking completo ›
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
              🎁 Donaciones
            </p>
            {topDon.length === 0 ? (
              <p className="text-sm text-ink-soft">Sin datos.</p>
            ) : (
              <ul className="space-y-1">
                {topDon.map((m, i) => (
                  <li key={m.tag} className="flex items-center gap-2 text-sm">
                    <span className="w-4 flex-none font-extrabold text-gold-deep">{i + 1}</span>
                    <Link
                      href={`/member/${encodeURIComponent(m.tag)}`}
                      className="min-w-0 flex-1 truncate font-bold text-ink hover:underline"
                    >
                      {m.name}
                    </Link>
                    <span className="font-extrabold tabular-nums text-ink">
                      {(m.donations ?? 0).toLocaleString("es-ES")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
              ⭐ Guerra
            </p>
            {topWar.length === 0 ? (
              <p className="text-sm text-ink-soft">Sin datos.</p>
            ) : (
              <ul className="space-y-1">
                {topWar.map((m, i) => (
                  <li key={m.tag} className="flex items-center gap-2 text-sm">
                    <span className="w-4 flex-none font-extrabold text-gold-deep">{i + 1}</span>
                    <Link
                      href={`/member/${encodeURIComponent(m.tag)}`}
                      className="min-w-0 flex-1 truncate font-bold text-ink hover:underline"
                    >
                      {m.name}
                    </Link>
                    <span className="font-extrabold tabular-nums text-ink">⭐ {m.warStars}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
