import Link from "next/link";
import {
  UserRound,
  Link2,
  RefreshCw,
  Smartphone,
  Gift,
  Star,
  Coins,
  MessageCircle,
  History,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { getMembersOverview } from "@/lib/dashboard";
import { getMyPlayerTag } from "@/lib/profile";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { ThImage } from "@/components/ThImage";
import { InstallAppCard } from "@/components/InstallAppCard";
import { SnapshotRunner } from "@/components/SnapshotRunner";
import { PerfilForm } from "./PerfilForm";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

function SectionHeader({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center gap-2 px-1 text-ink-soft">
      <Icon className="h-4 w-4" />
      <h2 className="text-xs font-extrabold uppercase tracking-wide">{children}</h2>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div className="p-3">
      <p className={`flex items-center justify-center gap-1 text-lg font-extrabold ${color}`}>
        <Icon className="h-4 w-4" />
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
    </div>
  );
}

export default async function PerfilPage() {
  const user = await getCurrentUser();

  const [linkedTag, data] = await Promise.all([getMyPlayerTag(), getMembersOverview()]);
  const me = linkedTag ? data.members.find((m) => m.tag === linkedTag) ?? null : null;
  const linkedName = me?.name ?? null;

  return (
    <AppShell email={user?.email} title="Perfil">
      {/* Mi jugador (si está vinculado y sigue en el clan) */}
      {me ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
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
              <p className="mt-1 flex items-center gap-1.5 text-sm">
                <MessageCircle className="h-4 w-4 text-ink-soft" />
                {me.discordUsername ? (
                  <span className="font-semibold text-[#5865F2]">@{me.discordUsername}</span>
                ) : (
                  <span className="text-ink-soft">Discord sin vincular</span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
            <Stat icon={Gift} value={me.donations ?? "—"} label="Donadas" color="text-grass" />
            <Stat icon={Star} value={me.warStars ?? "—"} label="Guerra" color="text-gold-deep" />
            <Stat
              icon={Coins}
              value={me.capitalContributions ?? "—"}
              label="Capital"
              color="text-sky"
            />
          </div>

          <Link
            href={`/member/${encodeURIComponent(me.tag)}`}
            className="flex items-center justify-center gap-1 border-t border-line py-3 text-sm font-extrabold text-gold-deep hover:bg-surface-2/60"
          >
            Ver mi ficha completa ›
          </Link>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4">
          <Link2 className="mt-0.5 h-5 w-5 flex-none text-gold-deep" />
          <div>
            <p className="font-extrabold text-ink">Aún no has vinculado tu cuenta de Clash</p>
            <p className="text-sm text-ink-soft">
              Vincúlala abajo para ver aquí tu jugador, liga y estadísticas.
            </p>
          </div>
        </div>
      )}

      <SectionHeader icon={UserRound}>Cuenta</SectionHeader>
      <PerfilForm email={user?.email ?? null} linkedTag={linkedTag} linkedName={linkedName} />

      <SectionHeader icon={RefreshCw}>Sincronización</SectionHeader>
      <SnapshotRunner />

      <SectionHeader icon={History}>Tareas automáticas</SectionHeader>
      <Link
        href="/registro"
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2/60"
      >
        <History className="h-5 w-5 flex-none text-ink-soft" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-ink">Registro de tareas</p>
          <p className="text-xs text-ink-soft">Roles de TH, inscripciones de CWL y avisos de guerra</p>
        </div>
        <ChevronRight className="h-4 w-4 flex-none text-ink-soft" />
      </Link>

      <SectionHeader icon={Smartphone}>Aplicación</SectionHeader>
      <InstallAppCard />

      {/* Cerrar sesión */}
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="flex w-full items-center justify-center gap-2 rounded-full border border-banner/40 px-4 py-2.5 text-sm font-extrabold text-banner transition hover:bg-banner/10">
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </form>
    </AppShell>
  );
}
