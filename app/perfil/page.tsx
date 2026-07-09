import Link from "next/link";
import { getMembersOverview } from "@/lib/dashboard";
import { getMyPlayerTag } from "@/lib/profile";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { ThImage } from "@/components/ThImage";
import { InstallAppCard } from "@/components/InstallAppCard";
import { PerfilForm } from "./PerfilForm";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

export default async function PerfilPage() {
  const user = await getCurrentUser();

  const [linkedTag, data] = await Promise.all([getMyPlayerTag(), getMembersOverview()]);
  const me = linkedTag ? data.members.find((m) => m.tag === linkedTag) ?? null : null;
  const linkedName = me?.name ?? null;

  return (
    <AppShell email={user?.email} title="Perfil">
      {/* Mi jugador (si está vinculado y sigue en el clan) */}
      {me && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center gap-3 p-4">
            <ThImage th={me.townHall} size={60} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-xl font-extrabold text-ink">{me.name}</p>
                <span className="rounded-full bg-sky/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sky">
                  Tú
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
                {me.leagueTierIcon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.leagueTierIcon} alt="" width={20} height={20} className="h-5 w-5" />
                )}
                <span className="font-semibold text-ink">
                  {me.leagueTierName?.replace(" League", "") ?? "Sin rango"}
                </span>
                <span>· {me.role ? (ROLE_LABEL[me.role] ?? me.role) : "Miembro"}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
            <div className="p-3">
              <p className="text-lg font-extrabold text-gold-deep">🏆 {me.trophies ?? "—"}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Copas</p>
            </div>
            <div className="p-3">
              <p className="text-lg font-extrabold text-grass">🎁 {me.donations ?? "—"}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Donadas</p>
            </div>
            <div className="p-3">
              <p className="text-lg font-extrabold text-ink">⭐ {me.warStars ?? "—"}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Guerra</p>
            </div>
          </div>

          <Link
            href={`/member/${encodeURIComponent(me.tag)}`}
            className="flex items-center justify-center gap-1 border-t border-line py-3 text-sm font-extrabold text-gold-deep hover:bg-surface-2/60"
          >
            Ver mi ficha completa ›
          </Link>
        </div>
      )}

      <PerfilForm email={user?.email ?? null} linkedTag={linkedTag} linkedName={linkedName} />

      <div className="mt-4">
        <InstallAppCard />
      </div>

      {/* Cerrar sesión */}
      <form action="/auth/signout" method="post" className="mt-5">
        <button className="w-full rounded-full border border-banner/40 px-4 py-2.5 text-sm font-extrabold text-banner transition hover:bg-banner/10">
          Cerrar sesión
        </button>
      </form>
    </AppShell>
  );
}
