import Link from "next/link";
import { getMembersOverview } from "@/lib/dashboard";
import { getDepartures } from "@/lib/history";
import { getMyPlayerTag } from "@/lib/profile";
import { getAccountLinks } from "@/lib/accounts";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { MembersTable } from "@/components/MembersTable";
import { MemberNote } from "@/components/MemberNote";

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
  searchParams: Promise<{ tab?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "ex" ? "ex" : "activos";
  const showAll = sp.all === "1"; // mostrar también los efímeros (0-1 días)

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

  // Los que estuvieron 0-1 días no son "exmiembros" de verdad: gente que se une
  // y se sale, o a quien se echa al momento. Se ocultan para no ensuciar la lista.
  const EPHEMERAL_DAYS = 1;
  const shownDepartures = departures.filter((d) => {
    const s = daysBetween(d.firstSeenAt, d.lastSeenAt);
    return s == null || s > EPHEMERAL_DAYS;
  });
  const hiddenCount = departures.length - shownDepartures.length;
  const list = showAll ? departures : shownDepartures; // lista efectiva a mostrar

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
        <>
          {hiddenCount > 0 && (
            <div className="mb-3 flex justify-end">
              <Link
                href={showAll ? "/miembros?tab=ex" : "/miembros?tab=ex&all=1"}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2"
              >
                {showAll ? "Ocultar efímeros" : `Ver ocultos (${hiddenCount})`}
              </Link>
            </div>
          )}
          {list.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-10 text-center">
              <p className="text-4xl">👋</p>
              <p className="mt-2 font-bold text-ink-soft">Nadie ha abandonado el clan (aún).</p>
            </div>
          ) : (
            <>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {list.map((d) => {
                const stay = daysBetween(d.firstSeenAt, d.lastSeenAt);
                return (
                  <li key={d.tag} className="flex items-start gap-3 px-3.5 py-2.5">
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
                      <MemberNote
                        tag={d.tag}
                        initialNote={d.note}
                        initialBy={d.noteBy}
                        initialAt={d.noteAt}
                        placeholder="Ej.: expulsado por inactivo / se fue solo / tóxico…"
                      />
                    </div>
                    <span className="mt-0.5 whitespace-nowrap rounded-full bg-banner/12 px-2.5 py-1 text-xs font-extrabold text-banner">
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
            {!showAll && hiddenCount > 0 && (
              <> Se ocultan {hiddenCount} que estuvieron solo 0-1 días (entraron y se salieron).</>
            )}
          </p>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
