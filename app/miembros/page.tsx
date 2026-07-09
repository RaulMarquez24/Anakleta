import Link from "next/link";
import { getMembersOverview } from "@/lib/dashboard";
import { getDepartures } from "@/lib/history";
import { getMyPlayerTag } from "@/lib/profile";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { MembersTable } from "@/components/MembersTable";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(
    new Date(iso),
  );
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export default async function MiembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "ex" ? "ex" : "activos";

  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [data, departures, myTag] = await Promise.all([
    getMembersOverview(),
    tab === "ex" ? getDepartures() : Promise.resolve([]),
    getMyPlayerTag(),
  ]);

  const tabCls = (active: boolean) =>
    `flex-1 rounded-full px-4 py-1.5 text-center text-sm font-extrabold transition ${
      active ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
    }`;

  return (
    <AppShell email={user?.email} title="Miembros">
      {/* Pestañas Miembros | Exmiembros */}
      <div className="mb-4 flex gap-2">
        <Link href="/miembros" className={tabCls(tab === "activos")}>
          👥 Miembros ({data.members.length})
        </Link>
        <Link href="/miembros?tab=ex" className={tabCls(tab === "ex")}>
          📤 Exmiembros
        </Link>
      </div>

      {tab === "activos" ? (
        <MembersTable members={data.members} myTag={myTag} />
      ) : departures.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-4xl">👋</p>
          <p className="mt-2 font-bold text-ink-soft">Nadie ha abandonado el clan (aún).</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {departures.map((d) => {
                const stay = daysBetween(d.firstSeenAt, d.lastSeenAt);
                return (
                  <li key={d.tag} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-ink">{d.name}</span>
                      <span className="ml-2 text-xs text-ink-soft">
                        {d.role ? (ROLE_LABEL[d.role] ?? d.role) : "—"}
                        {d.townHall != null && <> · TH{d.townHall}</>}
                      </span>
                      <p className="text-xs text-ink-soft">
                        Alta {fmtDate(d.firstSeenAt)}
                        {stay != null && <> · estuvo {stay} día{stay === 1 ? "" : "s"}</>}
                      </p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-banner/12 px-2.5 py-1 text-xs font-extrabold text-banner">
                      Se fue {fmtDate(d.lastSeenAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Se registra una baja cuando un tag deja de aparecer en la lista del clan entre capturas (se
            fue o lo expulsaron). La fecha de &ldquo;se fue&rdquo; es la última captura en la que aún estaba.
          </p>
        </>
      )}
    </AppShell>
  );
}
