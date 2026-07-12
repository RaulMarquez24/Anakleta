import Link from "next/link";
import { getMembersOverview } from "@/lib/dashboard";
import { getDepartures } from "@/lib/history";
import { getMyPlayerTag } from "@/lib/profile";
import { getAccountLinks } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { MembersTable } from "@/components/MembersTable";
import { DeparturesList } from "@/components/DeparturesList";

export const dynamic = "force-dynamic";

export default async function MiembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "ex" ? "ex" : "activos";

  const user = await getCurrentUser();

  const [data, departures, myTag, links] = await Promise.all([
    getMembersOverview(),
    tab === "ex" ? getDepartures() : Promise.resolve([]),
    getMyPlayerTag(),
    getAccountLinks(), // en fresco (sin caché): vínculos de cuentas al momento
  ]);

  // Mapa fresco tag -> {principal, nombre principal} para el badge "2ª de X".
  const linkNameByTag = new Map(links.map((l) => [l.tag, l.name]));
  const accountLinks: Record<string, { mainTag: string | null; mainName: string | null }> = {};
  for (const l of links) {
    accountLinks[l.tag] = {
      mainTag: l.mainTag,
      mainName: l.mainTag ? (linkNameByTag.get(l.mainTag) ?? null) : null,
    };
  }

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
        <MembersTable members={data.members} myTag={myTag} accountLinks={accountLinks} />
      ) : (
        <DeparturesList departures={departures} />
      )}
    </AppShell>
  );
}
