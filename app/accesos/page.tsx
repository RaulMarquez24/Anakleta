import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { isLeaderEmail, getAccessData } from "@/lib/access-log";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Madrid",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.round(h / 24);
  return `hace ${d}d`;
}

export default async function AccesosPage() {
  const user = await getCurrentUser();
  if (!isLeaderEmail(user?.email)) redirect("/");

  const { recent, perUser } = await getAccessData();

  return (
    <AppShell email={user?.email} title="Accesos" back="/perfil">
      <p className="mb-4 text-sm text-ink-soft">
        Quién ha entrado a la app y cuándo. Se registra como mucho un acceso por persona cada 15 min.
        Panel visible solo para ti.
      </p>

      {recent.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-8 text-center text-sm text-ink-soft">
          Aún no hay accesos registrados (o falta correr la migración).
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {/* Resumen por usuario */}
          <div>
            <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
              Por usuario ({perUser.length})
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <ul className="divide-y divide-line">
                {perUser.map((u) => (
                  <li key={u.email ?? "—"} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink">{u.email ?? "—"}</p>
                      <p className="text-xs text-ink-soft">{fmt(u.at)}</p>
                    </div>
                    <span className="flex-none rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-extrabold text-ink-soft">
                      {u.count} {u.count === 1 ? "acceso" : "accesos"}
                    </span>
                    <span className="flex-none text-[11px] font-bold text-grass">{ago(u.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Log reciente */}
          <div>
            <h2 className="mb-2 px-1 text-xs font-extrabold uppercase tracking-wide text-ink-soft">
              Últimos accesos ({recent.length})
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <ul className="divide-y divide-line">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                      {r.email ?? "—"}
                    </span>
                    <span className="flex-none text-xs text-ink-soft">{fmt(r.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
