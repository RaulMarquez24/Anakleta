import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberHistory } from "@/lib/history";
import { LineChart, type ChartPoint } from "@/components/LineChart";

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

export default async function MemberPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const history = await getMemberHistory(decodeURIComponent(tag));
  if (!history) notFound();

  const toPoint = (
    key: "donations" | "donationsReceived" | "trophies",
  ): ChartPoint[] =>
    history.snapshots
      .filter((s) => s[key] != null)
      .map((s) => ({ t: new Date(s.capturedAt).getTime(), v: s[key] as number }));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {history.name}{" "}
              {!history.isActive && (
                <span className="rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-300">
                  fuera del clan
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-400">
              {history.role ? (ROLE_LABEL[history.role] ?? history.role) : "—"} · TH{" "}
              {history.townHall ?? "—"} · {history.tag}
            </p>
            <p className="text-xs text-slate-500">
              Visto por primera vez {fmtDate(history.firstSeenAt)} · última vez{" "}
              {fmtDate(history.lastSeenAt)} · {history.snapshots.length} capturas
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            ← Miembros
          </Link>
        </header>

        <section className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-2 font-semibold text-amber-400">Trofeos</h2>
            <LineChart series={[{ label: "Trofeos", color: "#fbbf24", points: toPoint("trophies") }]} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="mb-2 font-semibold text-emerald-400">Donaciones</h2>
            <div className="mb-2 flex gap-4 text-xs text-slate-400">
              <span><span className="text-emerald-400">■</span> Donadas</span>
              <span><span className="text-slate-500">■</span> Recibidas</span>
            </div>
            <LineChart
              series={[
                { label: "Donadas", color: "#34d399", points: toPoint("donations") },
                { label: "Recibidas", color: "#64748b", points: toPoint("donationsReceived") },
              ]}
            />
            <p className="mt-2 text-xs text-slate-500">
              Las caídas bruscas a ~0 son el reseteo de temporada, no inactividad.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
