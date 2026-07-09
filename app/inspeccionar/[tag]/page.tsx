import { getClan } from "@/lib/coc";
import type { CocClan } from "@/lib/coc-types";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { ThImage } from "@/components/ThImage";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};
const ROLE_CLS: Record<string, string> = {
  leader: "bg-gold/25 text-gold-deep",
  coLeader: "bg-sky/15 text-sky",
  admin: "bg-magenta/15 text-magenta",
  member: "bg-surface-2 text-ink-soft",
};

export default async function InspeccionarPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const user = await getCurrentUser();
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);

  // Tiempo real, sin guardar: si falla (privado/inexistente), lo indicamos.
  let clan: CocClan | null = null;
  try {
    clan = await getClan<CocClan>(decoded);
  } catch {
    clan = null;
  }

  const members = [...(clan?.memberList ?? [])].sort((a, b) => a.clanRank - b.clanRank);

  return (
    <AppShell email={user?.email} title={clan?.name ? `🔍 ${clan.name}` : "Inspeccionar clan"} back="/war">
      {!clan ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-3xl">🔍</p>
          <p className="mt-2 font-bold text-ink-soft">
            No se pudo cargar este clan (puede estar en privado o no existir).
          </p>
        </div>
      ) : (
        <>
          {/* Perfil del clan */}
          <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              {clan.badgeUrls?.medium && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clan.badgeUrls.medium}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 flex-none"
                  style={{ objectFit: "contain" }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-extrabold text-ink">{clan.name}</p>
                <p className="text-xs font-semibold text-ink-soft">
                  {clan.members} miembros
                  {clan.clanLevel != null && <> · nivel {clan.clanLevel}</>}
                </p>
                {clan.warLeague?.name && (
                  <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-extrabold text-gold-deep">
                    ⚔️ {clan.warLeague.name}
                  </span>
                )}
              </div>
            </div>
            {clan.description && (
              <p className="mt-3 whitespace-pre-line text-[12px] leading-snug text-ink-soft">
                {clan.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
              {clan.clanPoints != null && (
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">
                  🏆 {clan.clanPoints.toLocaleString("es-ES")} pts
                </span>
              )}
              {clan.warWins != null && (
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">⚔️ {clan.warWins} ganadas</span>
              )}
              {clan.warWinStreak != null && clan.warWinStreak > 0 && (
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink">🔥 racha {clan.warWinStreak}</span>
              )}
              {clan.requiredTrophies != null && (
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink-soft">
                  copas mín. {clan.requiredTrophies}
                </span>
              )}
            </div>
          </div>

          {/* Miembros */}
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {members.map((m, i) => {
                const tier = m.leagueTier ?? m.league;
                const role = m.role ?? "member";
                return (
                  <li key={m.tag} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="w-5 flex-none text-center text-xs font-bold text-ink-soft">{i + 1}</span>
                    <ThImage th={m.townHallLevel} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold text-ink">{m.name}</span>
                        <span
                          className={`flex-none rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${ROLE_CLS[role] ?? ROLE_CLS.member}`}
                        >
                          {ROLE_LABEL[role] ?? role}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                        {tier?.iconUrls?.small && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tier.iconUrls.small} alt="" width={16} height={16} className="h-4 w-4" />
                        )}
                        <span className="truncate">{tier?.name?.replace(" League", "") ?? "Sin rango"}</span>
                        <span>· 🏆 {m.trophies}</span>
                      </div>
                    </div>
                    <span className="flex-none text-xs font-bold text-ink-soft">TH{m.townHallLevel}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            Datos en vivo de la API de Clash of Clans. No se guardan: al salir de esta pantalla
            desaparecen.
          </p>
        </>
      )}
    </AppShell>
  );
}
