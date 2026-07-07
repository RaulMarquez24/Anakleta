import { getMembersOverview } from "@/lib/dashboard";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

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

export default async function DashboardPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await getMembersOverview();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {data.clanName ?? "Clan"}{" "}
              {data.clanLevel != null && (
                <span className="text-slate-500">· nivel {data.clanLevel}</span>
              )}
            </h1>
            <p className="text-sm text-slate-400">
              {data.members.length} miembros · última captura {fmtDate(data.latestCapture)}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-400">{user?.email}</span>
            <form action="/auth/signout" method="post">
              <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-300 transition hover:bg-slate-800">
                Salir
              </button>
            </form>
          </div>
        </header>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Miembro</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 text-center font-medium">TH</th>
                <th className="px-3 py-2 text-right font-medium">Trofeos</th>
                <th className="px-3 py-2 text-right font-medium">Donadas</th>
                <th className="px-3 py-2 text-right font-medium">Recibidas</th>
                <th className="px-3 py-2 text-right font-medium">Ratio</th>
                <th className="px-3 py-2 text-center font-medium">Actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.members.map((m) => (
                <tr key={m.tag} className="hover:bg-slate-900/50">
                  <td className="px-3 py-2 text-slate-500">{m.clanRank ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {m.role ? (ROLE_LABEL[m.role] ?? m.role) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-300">{m.townHall ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.trophies ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.donations ?? "—"}
                    {m.donationsDelta != null && m.donationsDelta > 0 && (
                      <span className="ml-1 text-xs text-emerald-500">+{m.donationsDelta}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                    {m.donationsReceived ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {m.ratio == null ? (
                      "—"
                    ) : (
                      <span className={m.ratio < 1 ? "text-amber-400" : "text-slate-200"}>
                        {m.ratio.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {m.hadChange == null ? (
                      <span className="text-slate-600" title="Sin captura previa para comparar">
                        —
                      </span>
                    ) : m.hadChange ? (
                      <span className="text-emerald-500" title="Cambió donaciones o trofeos desde la captura anterior">
                        ●
                      </span>
                    ) : (
                      <span className="text-slate-500" title="Sin cambios desde la captura anterior">
                        ○
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Ratio &lt; 1 (en ámbar) = recibe más de lo que dona. La columna Actividad es
          preliminar (compara con la captura anterior); se refinará en el Hito 7 teniendo
          en cuenta el reseteo de temporada.
        </p>
      </div>
    </main>
  );
}
