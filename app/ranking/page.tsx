import Link from "next/link";
import { getActivityReport, type ActivityRow } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

type Metric = "liga" | "donaciones" | "guerra" | "participacion";

const METRICS: { key: Metric; label: string; icon: string }[] = [
  { key: "liga", label: "Liga", icon: "🏆" },
  { key: "donaciones", label: "Donaciones", icon: "🎁" },
  { key: "guerra", label: "Guerra", icon: "⭐" },
  { key: "participacion", label: "Participación", icon: "🏅" },
];

const MEDAL = ["🥇", "🥈", "🥉"];

function href(tag: string) {
  return `/member/${encodeURIComponent(tag)}`;
}

// Ordena y decide el valor visible a la derecha según la métrica.
function order(members: ActivityRow[], metric: Metric): ActivityRow[] {
  const list = [...members];
  switch (metric) {
    case "liga":
      // El rango real es leagueTierId (monótono). Copas solo como desempate.
      return list.sort(
        (a, b) => (b.leagueTierId ?? -1) - (a.leagueTierId ?? -1) || (b.trophies ?? -1) - (a.trophies ?? -1),
      );
    case "donaciones":
      return list.sort((a, b) => (b.donations ?? 0) - (a.donations ?? 0));
    case "guerra":
      return list.sort((a, b) => b.warStars - a.warStars || b.warAttacks - a.warAttacks);
    case "participacion":
      return list.sort((a, b) => b.participationScore - a.participationScore);
  }
}

function valueNode(m: ActivityRow, metric: Metric) {
  switch (metric) {
    case "liga":
      return (
        <span className="flex items-center gap-2">
          {m.leagueTierIcon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.leagueTierIcon} alt="" width={24} height={24} style={{ height: 24, width: 24 }} />
          ) : null}
          <span className="text-right">
            <span className="block text-xs font-bold leading-tight text-ink">
              {m.leagueTierName?.replace(" League", "") ?? "Sin rango"}
            </span>
            <span className="block text-[11px] font-semibold text-gold-deep">🏆 {m.trophies ?? "—"}</span>
          </span>
        </span>
      );
    case "donaciones":
      return <span className="font-extrabold tabular-nums text-ink">{(m.donations ?? 0).toLocaleString("es-ES")}</span>;
    case "guerra":
      return (
        <span className="text-right">
          <span className="block font-extrabold tabular-nums text-ink">⭐ {m.warStars}</span>
          <span className="block text-[11px] text-ink-soft">{m.warAttacks} ataques</span>
        </span>
      );
    case "participacion":
      return <span className="font-extrabold tabular-nums text-ink">{m.participationScore.toLocaleString("es-ES")}</span>;
  }
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const metric: Metric =
    sp.m === "donaciones" || sp.m === "guerra" || sp.m === "participacion" ? sp.m : "liga";

  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const report = await getActivityReport("todo");
  const ranked = order(report.members, metric);
  const total = ranked.length;

  return (
    <AppShell email={user?.email} title="🏆 Ranking del clan" back="/estadisticas">
      {/* Selector de métrica */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {METRICS.map((m) => (
          <Link
            key={m.key}
            href={`/ranking?m=${m.key}`}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-extrabold transition ${
              metric === m.key ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
            }`}
          >
            <span className="text-base leading-none">{m.icon}</span>
            {m.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <ul className="divide-y divide-line">
          {ranked.map((m, i) => (
            <li key={m.tag} className={`flex items-center gap-3 px-3.5 py-2.5 ${i < 3 ? "bg-gold/6" : ""}`}>
              <span className="w-7 flex-none text-center text-base font-extrabold tabular-nums text-ink-soft">
                {i < 3 ? MEDAL[i] : i + 1}
              </span>
              <Link href={href(m.tag)} className="min-w-0 flex-1">
                <span className="block truncate font-bold text-ink hover:underline">{m.name}</span>
                <span className="text-[11px] text-ink-soft">
                  {m.townHall != null ? `TH${m.townHall}` : "—"}
                </span>
              </Link>
              <div className="flex-none">{valueNode(m, metric)}</div>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-ink-soft">
        {metric === "liga"
          ? "Ordenado por liga real (leagueTier), no por copas: las copas se reinician cada semana y aquí solo desempatan."
          : `Acumulado desde que el panel guarda datos (todo el histórico), sobre ${total} miembros.`}
      </p>
    </AppShell>
  );
}
