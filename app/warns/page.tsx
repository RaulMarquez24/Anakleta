import { getCurrentUser } from "@/lib/supabase/current-user";
import { getAllWarnsByMember, getWarnConfig } from "@/lib/warns";
import { getMemberOptions } from "@/lib/dashboard";
import { AppShell } from "@/components/AppShell";
import { WarnsBrowser } from "@/components/WarnsBrowser";

export const dynamic = "force-dynamic";

export default async function WarnsPage() {
  const [user, groups, cfg, members] = await Promise.all([
    getCurrentUser(),
    getAllWarnsByMember(),
    getWarnConfig(),
    getMemberOptions(),
  ]);

  return (
    <AppShell email={user?.email} title="Warns" back="/miembros">
      <p className="mb-4 text-sm text-ink-soft">
        Warns agrupados por jugador. Busca por nombre, tag o motivo; con &ldquo;Todos&rdquo; ves también
        los caducados y resueltos. Umbral para &ldquo;A echar&rdquo;: {cfg.threshold} vigentes; caducan a
        los {cfg.expiryDays === 0 ? "∞" : `${cfg.expiryDays} días`}.
      </p>
      <WarnsBrowser groups={groups} threshold={cfg.threshold} members={members} />
    </AppShell>
  );
}
