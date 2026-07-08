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
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

function href(tag: string) {
  return `/member/${encodeURIComponent(tag)}`;
}

// "hace X" legible a partir de días (con decimal para <1 día → horas).
function ago(days: number | null, capped: boolean): string {
  if (days == null) return "sin datos";
  if (days < 1) {
    const h = Math.max(1, Math.round(days * 24));
    return `hace ${h} h`;
  }
  const d = Math.round(days);
  return `hace ${d} día${d === 1 ? "" : "s"}${capped ? "+" : ""}`;
}

export default async function ActividadPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const report = await getActivityReport();

  return (
    <AppShell email={user?.email}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">Actividad</h1>
        <span className="text-xs font-semibold text-ink-soft">
          Últimos {report.lookbackDays} días · {report.warsInPeriod} guerras
        </span>
      </div>

      {/* Altas y bajas */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold text-grass">
            <span aria-hidden>📥</span> Altas ({report.altas.length})
          </h2>
          {report.altas.length === 0 ? (
            <p className="text-sm text-ink-soft">Ninguna reciente.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {report.altas.map((a) => (
                <li key={a.tag} className="flex justify-between gap-2">
                  <Link href={href(a.tag)} className="font-bold text-ink hover:text-gold-deep hover:underline">{a.name}</Link>
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
                  <Link href={href(b.tag)} className="font-bold text-ink hover:text-gold-deep hover:underline">{b.name}</Link>
                  <span className="text-ink-soft">{fmtDate(b.lastSeenAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Actividad + participación en guerra */}
      <h2 className="mb-2 font-extrabold text-ink">Última actividad y guerra</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {report.inactivity.map((r) => {
            const susp = r.staleDays != null && r.staleDays >= report.thresholdDays;
            return (
              <li key={r.tag} className={`flex items-center gap-3 px-3.5 py-2.5 ${susp ? "bg-banner/8" : ""}`}>
                <div className="min-w-0 flex-1">
                  <Link href={href(r.tag)} className="font-bold text-ink hover:text-gold-deep hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-ink-soft">
                    {r.role ? (ROLE_LABEL[r.role] ?? r.role) : "—"}
                    {report.warsInPeriod > 0 && (
                      <> · ⚔️ {r.warsPlayed}/{report.warsInPeriod} guerras · {r.warAttacks} ataques</>
                    )}
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${
                    r.staleDays == null
                      ? "bg-surface-2 text-ink-soft"
                      : susp
                        ? "bg-banner/15 text-banner"
                        : "bg-grass/15 text-grass"
                  }`}
                  title={r.lastActivityAt ? `Última señal: ${fmtDate(r.lastActivityAt)}` : "Sin histórico todavía"}
                >
                  {r.staleDays != null && r.staleDays < 1 ? "activo" : ago(r.staleDays, r.capped)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        &ldquo;Última actividad&rdquo; = última vez que subió alguna señal (donaciones, copas,
        ataques, estrellas de guerra, aporte a capital o XP) entre capturas. La API de Clash no da
        la última conexión real; esto es lo más fiable posible. En ámbar, ≥ {report.thresholdDays}{" "}
        días sin actividad. La participación en guerra se acumula desde ahora.
      </p>
    </AppShell>
  );
}
