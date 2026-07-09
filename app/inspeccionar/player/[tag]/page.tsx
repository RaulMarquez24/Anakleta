import Link from "next/link";
import { getPlayer } from "@/lib/coc";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { ThImage } from "@/components/ThImage";
import { CopyTag } from "@/components/CopyTag";

export const dynamic = "force-dynamic";

interface LeagueRef {
  name?: string;
  iconUrls?: { small?: string; tiny?: string };
}
interface PlayerFull {
  tag: string;
  name: string;
  townHallLevel: number;
  expLevel?: number;
  trophies?: number;
  bestTrophies?: number;
  builderBaseTrophies?: number;
  warStars?: number;
  attackWins?: number;
  defenseWins?: number;
  donations?: number;
  donationsReceived?: number;
  warPreference?: "in" | "out";
  clanCapitalContributions?: number;
  role?: string;
  league?: LeagueRef;
  leagueTier?: LeagueRef;
  clan?: { tag: string; name: string; clanLevel?: number; badgeUrls?: { small?: string; medium?: string } };
}

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-base font-extrabold text-ink">{children}</p>
    </div>
  );
}

export default async function InspeccionarPlayerPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const user = await getCurrentUser();
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);

  let p: PlayerFull | null = null;
  try {
    p = await getPlayer<PlayerFull>(decoded);
  } catch {
    p = null;
  }

  const tier = p?.leagueTier ?? p?.league;

  return (
    <AppShell email={user?.email} title={p?.name ? `👤 ${p.name}` : "Inspeccionar jugador"} back="/inspeccionar">
      {!p ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-3xl">🔍</p>
          <p className="mt-2 font-bold text-ink-soft">No se pudo cargar este jugador (tag inválido o inexistente).</p>
        </div>
      ) : (
        <>
          {/* Identidad */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-center gap-3 p-4">
              <ThImage th={p.townHallLevel} size={60} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xl font-extrabold text-ink">{p.name}</p>
                  <CopyTag tag={p.tag} />
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
                  {tier?.iconUrls?.small && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tier.iconUrls.small} alt="" width={20} height={20} className="h-5 w-5" />
                  )}
                  <span className="font-semibold text-ink">{tier?.name?.replace(" League", "") ?? "Sin rango"}</span>
                  <span>· TH{p.townHallLevel}</span>
                </p>
              </div>
            </div>

            {/* Su clan (enlazable para inspeccionarlo también) */}
            {p.clan && (
              <Link
                href={`/inspeccionar/clan/${encodeURIComponent(p.clan.tag)}`}
                className="flex items-center gap-2.5 border-t border-line px-4 py-3 hover:bg-surface-2/60"
              >
                {p.clan.badgeUrls?.small && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.clan.badgeUrls.small} alt="" width={28} height={28} className="h-7 w-7 flex-none" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{p.clan.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {p.role ? (ROLE_LABEL[p.role] ?? p.role) : "Miembro"}
                    {p.clan.clanLevel != null && <> · nivel {p.clan.clanLevel}</>}
                  </span>
                </span>
                <span aria-hidden className="text-ink-soft">›</span>
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Copas (récord)">
              🏆 {p.trophies ?? "—"}
              {p.bestTrophies != null && <span className="text-xs font-semibold text-ink-soft"> / {p.bestTrophies}</span>}
            </Stat>
            <Stat label="Estrellas de guerra">⭐ {p.warStars ?? "—"}</Stat>
            <Stat label="Ataques / Defensas">
              {p.attackWins ?? "—"} / {p.defenseWins ?? "—"}
            </Stat>
            <Stat label="Preferencia de guerra">
              {p.warPreference === "in" ? "⚔️ Entra" : p.warPreference === "out" ? "💤 No entra" : "—"}
            </Stat>
            <Stat label="Aporte a la capital">
              {p.clanCapitalContributions != null ? p.clanCapitalContributions.toLocaleString("es-ES") : "—"}
            </Stat>
            <Stat label="Nivel · Constructor">
              {p.expLevel ?? "—"} · 🔨 {p.builderBaseTrophies ?? "—"}
            </Stat>
          </div>

          <p className="mt-3 text-xs text-ink-soft">
            Datos en vivo de la API de Clash of Clans. No se guardan: al salir desaparecen.
          </p>
        </>
      )}
    </AppShell>
  );
}
