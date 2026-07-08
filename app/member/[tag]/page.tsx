import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberHistory } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 font-bold text-ink">{children}</p>
    </div>
  );
}

export default async function MemberPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { tag } = await params;
  const history = await getMemberHistory(decodeURIComponent(tag));
  if (!history) notFound();

  const isNew =
    history.isActive &&
    history.firstSeenAt != null &&
    Date.now() - new Date(history.firstSeenAt).getTime() < 7 * 86_400_000;

  const toPoint = (
    key: "donations" | "donationsReceived" | "trophies",
  ): ChartPoint[] =>
    history.snapshots
      .filter((s) => s[key] != null)
      .map((s) => ({ t: new Date(s.capturedAt).getTime(), v: s[key] as number }));

  return (
    <AppShell email={user?.email} title={history.name}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="text-sm font-bold text-sky hover:underline">
          ← Miembros
        </Link>
        <div className="flex items-center gap-2">
          {isNew && (
            <span className="rounded-full bg-grass/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-grass">
              Nuevo
            </span>
          )}
          {!history.isActive && (
            <span className="rounded-full bg-banner/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-banner">
              Fuera del clan
            </span>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm font-semibold text-ink-soft">
        {history.role ? (ROLE_LABEL[history.role] ?? history.role) : "—"} · TH {history.townHall ?? "—"} ·{" "}
        {history.snapshots.length} capturas
      </p>

      {/* Estadísticas actuales */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Rango">
          <span className="inline-flex items-center gap-1.5">
            {history.current.leagueTierIcon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={history.current.leagueTierIcon} alt="" width={22} height={22} className="h-[22px] w-[22px]" />
            )}
            {history.current.leagueTierName?.replace(" League", "") ?? "Sin rango"}
          </span>
        </Stat>
        <Stat label="Copas (ranked)">{history.current.trophies ?? "—"}</Stat>
        <Stat label="Estrellas de guerra">⭐ {history.current.warStars ?? "—"}</Stat>
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
        <Stat label="Alta (aprox.)">{fmtDate(history.firstSeenAt)}</Stat>
      </div>

      <section className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold text-gold-deep">
            <span aria-hidden>🏆</span> Trofeos
          </h2>
          <LineChart series={[{ label: "Trofeos", color: "var(--gold-deep)", points: toPoint("trophies") }]} />
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
          <p className="mt-2 text-xs text-ink-soft">
            Las caídas bruscas a ~0 son el reseteo de temporada, no inactividad.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
