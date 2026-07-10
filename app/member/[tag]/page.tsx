import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberHistory, getActivityReport, type ActivityRow } from "@/lib/history";
import { getMemberWarLog } from "@/lib/war-history";
import { getMyPlayerTag } from "@/lib/profile";
import { getAccountLinks, accountGroup } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { LineChart, type ChartPoint } from "@/components/LineChart";
import { ThImage } from "@/components/ThImage";
import { CopyTag } from "@/components/CopyTag";
import { MemberNote } from "@/components/MemberNote";
import { AccountLinker } from "@/components/AccountLinker";
import { seasonLabel } from "@/components/WarBits";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};
const ROLE_CLS: Record<string, string> = {
  leader: "bg-gold/25 text-gold-deep",
  coLeader: "bg-sky/15 text-sky",
  admin: "bg-magenta/15 text-magenta",
  member: "bg-surface-2 text-ink-soft",
};
const CAT_LABEL: Record<string, { label: string; cls: string }> = {
  expulsion: { label: "🔴 Expulsión", cls: "bg-banner/15 text-banner" },
  revisar: { label: "🟡 Revisar", cls: "bg-gold/25 text-gold-deep" },
  destacado: { label: "🟢 Destacado", cls: "bg-grass/15 text-grass" },
  ok: { label: "OK", cls: "bg-surface-2 text-ink-soft" },
  mando: { label: "Mando", cls: "bg-sky/15 text-sky" },
};
// Liga respecto a su TH: chip con color e icono (verde adecuada, azul por
// encima, ámbar/rojo por debajo).
const LEAGUE_VS: Record<string, { label: string; cls: string; icon: string }> = {
  muy_alta: { label: "Liga muy alta", cls: "bg-sky/15 text-sky", icon: "⏫" },
  alta: { label: "Liga alta", cls: "bg-sky/15 text-sky", icon: "↑" },
  normal: { label: "Liga adecuada", cls: "bg-grass/15 text-grass", icon: "✓" },
  baja: { label: "Liga baja", cls: "bg-gold/25 text-gold-deep", icon: "↓" },
  muy_baja: { label: "Liga muy baja", cls: "bg-banner/15 text-banner", icon: "⏬" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(
    new Date(iso),
  );
}
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-base font-extrabold text-ink">{children}</p>
    </div>
  );
}

function rankOf(members: ActivityRow[], tag: string, value: (m: ActivityRow) => number): number {
  return [...members].sort((a, b) => value(b) - value(a)).findIndex((m) => m.tag === tag) + 1;
}

export default async function MemberPage({ params }: { params: Promise<{ tag: string }> }) {
  const user = await getCurrentUser();

  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const [history, report, warLog, myTag, accountLinks] = await Promise.all([
    getMemberHistory(decoded),
    getActivityReport("todo").catch(() => null),
    getMemberWarLog(decoded),
    getMyPlayerTag(),
    getAccountLinks(),
  ]);
  if (!history) notFound();
  const { members: accGroup } = accountGroup(accountLinks, decoded);
  const accCandidates = accountLinks.filter((l) => l.tag !== decoded);
  const isMe = myTag != null && myTag === decoded;

  const row = report?.members.find((m) => m.tag === decoded) ?? null;
  const total = report?.members.length ?? 0;
  const ranks = row
    ? {
        liga: rankOf(report!.members, decoded, (m) => m.leagueTierId ?? -1),
        don: rankOf(report!.members, decoded, (m) => m.donations ?? 0),
        stars: rankOf(report!.members, decoded, (m) => m.warStars),
        part: rankOf(report!.members, decoded, (m) => m.participationScore),
      }
    : null;

  const isNew =
    history.isActive &&
    history.firstSeenAt != null &&
    Date.now() - new Date(history.firstSeenAt).getTime() < 7 * 86_400_000;

  const toPoint = (key: "donations" | "donationsReceived" | "trophies"): ChartPoint[] =>
    history.snapshots
      .filter((s) => s[key] != null)
      .map((s) => ({ t: new Date(s.capturedAt).getTime(), v: s[key] as number }));

  return (
    <AppShell email={user?.email} title={history.name} back="/miembros">
      {/* Hero: identidad + rankings + actividad */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface">
        {/* Liga | TH */}
        <div className="grid grid-cols-2 divide-x divide-line">
          <div className="flex flex-col items-center gap-1 p-4 text-center">
            {history.current.leagueTierIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={history.current.leagueTierIcon} alt="" width={52} height={52} style={{ height: 52, width: 52 }} />
            ) : (
              <span className="text-4xl">🏅</span>
            )}
            <p className="font-extrabold leading-tight text-ink">
              {history.current.leagueTierName?.replace(" League", "") ?? "Sin rango"}
            </p>
            <p className="text-sm font-extrabold text-gold-deep">🏆 {history.current.trophies ?? "—"}</p>
          </div>
          <div className="flex flex-col items-center gap-1 p-4 text-center">
            <ThImage th={history.townHall} size={56} />
            <p className="text-xl font-extrabold text-ink">TH {history.townHall ?? "—"}</p>
            <p className="text-xs font-semibold text-ink-soft">Nivel {history.current.expLevel ?? "—"}</p>
          </div>
        </div>

        {/* Rol · tag · estado */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
              ROLE_CLS[history.role ?? "member"] ?? "bg-surface-2 text-ink-soft"
            }`}
          >
            {history.role ? (ROLE_LABEL[history.role] ?? history.role) : "—"}
          </span>
          <CopyTag tag={history.tag} />
          {isMe && (
            <span className="rounded-full bg-sky/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky">
              Tú
            </span>
          )}
          {isNew && (
            <span className="rounded-full bg-grass/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-grass">
              Nuevo
            </span>
          )}
          {!history.isActive && (
            <span className="rounded-full bg-banner/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-banner">
              Fuera
            </span>
          )}
        </div>

        {ranks && (
          <Link href="/ranking" className="block border-t border-line px-4 py-3 hover:bg-surface-2/50">
            <p className="mb-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
              <span>Ranking en el clan · de {total}</span>
              <span className="text-ink-soft">ver todo ›</span>
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[11px] text-ink-soft">🏆 Liga</p>
                <p className="text-xl font-extrabold text-ink">#{ranks.liga}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-soft">🎁 Dona</p>
                <p className="text-xl font-extrabold text-ink">#{ranks.don}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-soft">⭐ Guerra</p>
                <p className="text-xl font-extrabold text-ink">#{ranks.stars}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-soft">🏅 Particip.</p>
                <p className="text-xl font-extrabold text-ink">#{ranks.part}</p>
              </div>
            </div>
          </Link>
        )}

        {row && (
          <>
            {/* Veredicto + actividad */}
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${CAT_LABEL[row.category].cls}`}>
                {CAT_LABEL[row.category].label}
              </span>
              {row.leagueVsTh && (
                <span
                  title="Su liga comparada con los compañeros del mismo ayuntamiento"
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${LEAGUE_VS[row.leagueVsTh].cls}`}
                >
                  {LEAGUE_VS[row.leagueVsTh].icon} {LEAGUE_VS[row.leagueVsTh].label} p/ su TH
                </span>
              )}
              <span
                className={`ml-auto flex items-center gap-1.5 text-xs font-bold ${
                  row.staleDays != null && row.staleDays < 1 ? "text-grass" : "text-ink-soft"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${row.staleDays != null && row.staleDays < 1 ? "bg-grass-bright ring-4 ring-grass/20" : "bg-ink-soft/40"}`}
                />
                {row.staleDays == null
                  ? "Sin datos"
                  : row.staleDays < 1
                    ? "Activo hoy"
                    : `Hace ${Math.round(row.staleDays)}d${row.capped ? "+" : ""}`}
              </span>
            </div>

            {/* Alertas (faltillas) */}
            {row.flags.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-banner">
                  ⚠️ Alertas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {row.flags.map((f) => (
                    <span
                      key={f}
                      className="rounded-lg bg-banner/12 px-2 py-1 text-[11px] font-bold text-banner"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actividad reciente (qué señales se movieron) */}
            {row.recent.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
                  Actividad reciente
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {row.recent.map((s) => (
                    <span
                      key={s.key}
                      title={`Detectado en la captura del ${fmtDate(s.at)}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-grass/12 px-2 py-1 text-[11px] font-bold text-grass"
                    >
                      {s.icon} {s.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Nota manual del jugador */}
      <div className="mb-5 rounded-2xl border border-line bg-surface p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Nota</p>
        <MemberNote
          tag={history.tag}
          initialNote={history.note}
          initialBy={history.noteBy}
          initialAt={history.noteAt}
        />
      </div>

      {/* Cuentas de la persona (principal / secundarias) */}
      <div className="mb-5 rounded-2xl border border-line bg-surface p-4">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
          Cuentas del jugador
        </p>
        <AccountLinker
          tag={history.tag}
          mainTag={history.mainTag}
          group={accGroup}
          candidates={accCandidates}
        />
      </div>

      {/* Historial de liga (ranked semanal, bajo demanda) */}
      <Link
        href={`/member/${encodeURIComponent(decoded)}/liga`}
        className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        <span className="text-2xl">🏆</span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold text-ink">Ver historial de liga</span>
          <span className="block text-xs text-ink-soft">Copas, puesto y sus ataques semana a semana</span>
        </span>
        <span aria-hidden className="text-ink-soft">›</span>
      </Link>

      {/* Estadísticas actuales */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Copas (ranked)">{history.current.trophies ?? "—"}</Stat>
        <Stat label="Copas Constructor">🔨 {history.current.builderTrophies ?? "—"}</Stat>
        <Stat label="Estrellas de guerra (total)">⭐ {history.current.warStars ?? "—"}</Stat>
        <Stat label="Ataques / Defensas ganados">
          {history.current.attackWins ?? "—"} / {history.current.defenseWins ?? "—"}
        </Stat>
        <Stat label="Preferencia de guerra">
          {history.current.warPreference === "in"
            ? "⚔️ Entra"
            : history.current.warPreference === "out"
              ? "💤 No entra"
              : "—"}
        </Stat>
        <Stat label="Aporte a la capital">
          {history.current.capitalContributions != null
            ? history.current.capitalContributions.toLocaleString("es-ES")
            : "—"}
        </Stat>
        <Stat label="Visto desde (aprox.)">{fmtDate(history.firstSeenAt)}</Stat>
      </div>

      {/* Historial de guerra por temporada */}
      {warLog.seasons.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-extrabold text-ink">Guerra por temporada (CWL)</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-bold">Temporada</th>
                  <th className="px-3 py-2 text-right font-bold">Atacó</th>
                  <th className="px-3 py-2 text-right font-bold">⭐</th>
                  <th className="px-3 py-2 text-right font-bold">Sin atacar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {warLog.seasons.map((s) => (
                  <tr key={s.season}>
                    <td className="px-3 py-2 font-bold text-ink">{seasonLabel(s.season)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.attacks}/{s.rounds}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gold-deep">{s.stars}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.missed > 0 ? <span className="font-bold text-banner">{s.missed}</span> : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Últimas guerras */}
      {warLog.wars.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-extrabold text-ink">Últimas guerras</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {warLog.wars.slice(0, 12).map((w) => (
                <li key={w.warId}>
                  <Link href={`/guerra/${w.warId}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-2/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">
                        {w.isCwl ? `CWL R${w.round}` : "Guerra"} · vs {w.opponentName ?? "—"}
                      </p>
                      <p className="text-xs text-ink-soft">{fmtDate(w.startTime)}</p>
                    </div>
                    {w.attacksUsed > 0 ? (
                      <span className="text-sm font-bold text-gold-deep">⭐ {w.stars}</span>
                    ) : (
                      <span className="rounded-full bg-banner/15 px-2 py-0.5 text-xs font-extrabold text-banner">
                        No atacó
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Gráficas */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold text-gold-deep">
            <span aria-hidden>🏆</span> Copas (evolución)
          </h2>
          <LineChart series={[{ label: "Copas", color: "var(--gold-deep)", points: toPoint("trophies") }]} />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold text-grass">
            <span aria-hidden>🎁</span> Donaciones
          </h2>
          <div className="mb-2 flex gap-4 text-xs font-bold text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-grass" /> Donadas
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-sky" /> Recibidas
            </span>
          </div>
          <LineChart
            series={[
              { label: "Donadas", color: "var(--grass)", points: toPoint("donations") },
              { label: "Recibidas", color: "var(--sky)", points: toPoint("donationsReceived") },
            ]}
          />
        </div>
      </section>
    </AppShell>
  );
}
