import Link from "next/link";
import { getMembersOverview, type MemberOverviewRow } from "@/lib/dashboard";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

function roleBadge(role: string | null): { label: string; cls: string } {
  switch (role) {
    case "leader":
      return { label: "Líder", cls: "bg-gold/25 text-gold-deep" };
    case "coLeader":
      return { label: "Colíder", cls: "bg-sky/15 text-sky" };
    case "admin":
      return { label: "Veterano", cls: "bg-magenta/15 text-magenta" };
    default:
      return { label: "Miembro", cls: "bg-surface-2 text-ink-soft" };
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

function href(tag: string) {
  return `/member/${encodeURIComponent(tag)}`;
}

function RatioPill({ ratio }: { ratio: number | null }) {
  if (ratio == null)
    return <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink-soft">Ratio —</span>;
  const low = ratio < 1;
  return (
    <span
      className={`rounded-lg px-2 py-1 text-xs font-bold ${low ? "bg-banner/12 text-banner" : "bg-grass/15 text-grass"}`}
      title={low ? "Recibe más de lo que dona" : "Dona más de lo que recibe"}
    >
      Ratio {ratio.toFixed(1)}
    </span>
  );
}

function Activity({ m }: { m: MemberOverviewRow }) {
  if (m.hadChange == null)
    return <span className="text-xs font-bold text-ink-soft">Sin dato aún</span>;
  if (m.hadChange)
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-grass">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-grass-bright ring-4 ring-grass/20" />
        Activo
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ink-soft/40" />
      Sin cambios
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getMembersOverview();

  return (
    <AppShell email={user?.email}>
      {/* Resumen del clan */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">
          Miembros{" "}
          <span className="font-sans text-sm font-bold text-ink-soft">
            ({data.members.length})
          </span>
        </h1>
        <p className="text-xs font-semibold text-ink-soft">
          {data.clanLevel != null && <>Nivel {data.clanLevel} · </>}
          Captura: {fmtDate(data.latestCapture)}
        </p>
      </div>

      {/* Móvil: tarjetas */}
      <div className="space-y-3 sm:hidden">
        {data.members.map((m) => {
          const rb = roleBadge(m.role);
          const attention = m.ratio != null && m.ratio < 1;
          return (
            <Link
              key={m.tag}
              href={href(m.tag)}
              className={`block rounded-2xl border border-line bg-surface p-3.5 shadow-sm ${attention ? "border-l-4 border-l-banner" : "border-l-4 border-l-gold"}`}
            >
              <div className="mb-2.5 flex items-center gap-2">
                <span className="text-base font-extrabold text-ink">{m.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${rb.cls}`}>
                  {rb.label}
                </span>
                <span className="ml-auto rounded-full bg-sky px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                  TH{m.townHall ?? "—"}
                </span>
              </div>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink">
                  🏆 {m.trophies ?? "—"}
                </span>
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink">
                  🎁 {m.donations ?? "—"}
                  {m.donationsDelta != null && m.donationsDelta > 0 && (
                    <span className="ml-1 text-grass">+{m.donationsDelta}</span>
                  )}
                </span>
                <RatioPill ratio={m.ratio} />
              </div>
              <Activity m={m} />
            </Link>
          );
        })}
      </div>

      {/* Escritorio: tabla */}
      <div className="hidden overflow-hidden rounded-2xl border border-line sm:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-ink-soft">
            <tr>
              <th className="px-3 py-2.5 font-bold">#</th>
              <th className="px-3 py-2.5 font-bold">Miembro</th>
              <th className="px-3 py-2.5 font-bold">Rol</th>
              <th className="px-3 py-2.5 text-center font-bold">TH</th>
              <th className="px-3 py-2.5 text-right font-bold">Trofeos</th>
              <th className="px-3 py-2.5 text-right font-bold">Donadas</th>
              <th className="px-3 py-2.5 text-right font-bold">Recibidas</th>
              <th className="px-3 py-2.5 text-right font-bold">Ratio</th>
              <th className="px-3 py-2.5 text-center font-bold">Actividad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {data.members.map((m) => {
              const rb = roleBadge(m.role);
              return (
                <tr key={m.tag} className="hover:bg-surface-2/60">
                  <td className="px-3 py-2 text-ink-soft">{m.clanRank ?? "—"}</td>
                  <td className="px-3 py-2 font-bold">
                    <Link href={href(m.tag)} className="text-ink hover:text-gold-deep hover:underline">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${rb.cls}`}>
                      {rb.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-ink-soft">{m.townHall ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.trophies ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.donations ?? "—"}
                    {m.donationsDelta != null && m.donationsDelta > 0 && (
                      <span className="ml-1 text-xs text-grass">+{m.donationsDelta}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {m.donationsReceived ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.ratio == null ? (
                      "—"
                    ) : (
                      <span className={m.ratio < 1 ? "font-bold text-banner" : "text-ink"}>
                        {m.ratio.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center">
                      <Activity m={m} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        Ratio &lt; 1 = recibe más de lo que dona. &ldquo;Actividad&rdquo; compara con la
        captura anterior; ignora las bajadas por reseteo de temporada. Toca un miembro para ver su
        evolución.
      </p>
    </AppShell>
  );
}
