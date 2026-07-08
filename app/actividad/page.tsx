import Link from "next/link";
import { getActivityReport } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

function href(tag: string) {
  return `/member/${encodeURIComponent(tag)}`;
}

export default async function ActividadPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const report = await getActivityReport(7);

  return (
    <AppShell email={user?.email}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">Actividad</h1>
        <span className="text-xs font-semibold text-ink-soft">Últimos {report.windowDays} días</span>
      </div>

      {/* Altas y bajas */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold text-grass">
            <span aria-hidden>📥</span> Altas ({report.altas.length})
          </h2>
          {report.altas.length === 0 ? (
            <p className="text-sm text-ink-soft">Ninguna en la ventana.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {report.altas.map((a) => (
                <li key={a.tag} className="flex justify-between gap-2">
                  <Link href={href(a.tag)} className="font-bold text-ink hover:text-gold-deep hover:underline">
                    {a.name}
                  </Link>
                  <span className="text-ink-soft">{fmtDate(a.firstSeenAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold text-banner">
            <span aria-hidden>📤</span> Bajas ({report.bajas.length})
          </h2>
          {report.bajas.length === 0 ? (
            <p className="text-sm text-ink-soft">Ninguna en los últimos 30 días.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {report.bajas.map((b) => (
                <li key={b.tag} className="flex justify-between gap-2">
                  <Link href={href(b.tag)} className="font-bold text-ink hover:text-gold-deep hover:underline">
                    {b.name}
                  </Link>
                  <span className="text-ink-soft">{fmtDate(b.lastSeenAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Ranking de inactividad */}
      <h2 className="mb-2 font-extrabold text-ink">Quién lleva más sin moverse</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {report.inactivity.map((r) => {
            const susp = r.staleDays != null && r.staleDays >= 3;
            return (
              <li key={r.tag} className={`flex items-center gap-3 px-3.5 py-2.5 ${susp ? "bg-banner/8" : ""}`}>
                <div className="min-w-0 flex-1">
                  <Link href={href(r.tag)} className="font-bold text-ink hover:text-gold-deep hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {r.role ? (ROLE_LABEL[r.role] ?? r.role) : "—"} · último cambio {fmtDate(r.lastChangeAt)}
                  </p>
                </div>
                {r.staleDays == null ? (
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-soft">
                    sin datos
                  </span>
                ) : (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${susp ? "bg-banner/15 text-banner" : "bg-surface-2 text-ink-soft"}`}
                  >
                    {r.staleDays} d
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        &ldquo;Sin moverse&rdquo; = ni suben donaciones ni varían trofeos entre capturas. Las bajadas
        de donaciones (reseteo de temporada) se ignoran a propósito. En ámbar, ≥ 3 días. Con más
        histórico, más fiable.
      </p>
    </AppShell>
  );
}
