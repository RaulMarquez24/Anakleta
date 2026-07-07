import Link from "next/link";
import { getActivityReport } from "@/lib/history";

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

function tagHref(tag: string): string {
  return `/member/${encodeURIComponent(tag)}`;
}

export default async function ActividadPage() {
  const report = await getActivityReport(7);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Actividad</h1>
            <p className="text-sm text-slate-400">
              Ventana de análisis: últimos {report.windowDays} días
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            ← Miembros
          </Link>
        </header>

        {/* Altas y bajas */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-2 font-semibold text-emerald-400">
              Altas ({report.altas.length})
            </h2>
            {report.altas.length === 0 ? (
              <p className="text-sm text-slate-500">Ninguna en la ventana.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {report.altas.map((a) => (
                  <li key={a.tag} className="flex justify-between">
                    <Link href={tagHref(a.tag)} className="hover:underline">
                      {a.name}
                    </Link>
                    <span className="text-slate-500">{fmtDate(a.firstSeenAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-2 font-semibold text-red-400">
              Bajas ({report.bajas.length})
            </h2>
            {report.bajas.length === 0 ? (
              <p className="text-sm text-slate-500">Ninguna en los últimos 30 días.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {report.bajas.map((b) => (
                  <li key={b.tag} className="flex justify-between">
                    <Link href={tagHref(b.tag)} className="hover:underline">
                      {b.name}
                    </Link>
                    <span className="text-slate-500">{fmtDate(b.lastSeenAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Ranking de inactividad */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Miembro</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 text-right font-medium">Días sin cambios</th>
                <th className="px-3 py-2 font-medium">Último cambio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {report.inactivity.map((r) => {
                const susp = r.staleDays != null && r.staleDays >= 3;
                return (
                  <tr key={r.tag} className={susp ? "bg-amber-950/20" : ""}>
                    <td className="px-3 py-2 font-medium">
                      <Link href={tagHref(r.tag)} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {r.role ? (ROLE_LABEL[r.role] ?? r.role) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.staleDays == null ? (
                        <span className="text-slate-600">sin datos</span>
                      ) : (
                        <span className={susp ? "text-amber-400" : "text-slate-300"}>
                          {r.staleDays}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{fmtDate(r.lastChangeAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          &ldquo;Sin cambios&rdquo; = ni suben donaciones ni varían trofeos entre capturas. Las
          bajadas de donaciones (reseteo de temporada) se ignoran a propósito. Cuantos más días,
          más sospechoso (ámbar ≥ 3 días). Con más histórico acumulado, más fiable.
        </p>
      </div>
    </main>
  );
}
