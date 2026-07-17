import { getCurrentUser } from "@/lib/supabase/current-user";
import { getAllWarnsByMember, getWarnConfig } from "@/lib/warns";
import { AppShell } from "@/components/AppShell";
import { WarnsBrowser } from "@/components/WarnsBrowser";

export const dynamic = "force-dynamic";

export default async function WarnsPage() {
  const [user, groups, cfg] = await Promise.all([
    getCurrentUser(),
    getAllWarnsByMember(),
    getWarnConfig(),
  ]);

  return (
    <AppShell email={user?.email} title="⚠️ Warns" back="/miembros">
      <p className="mb-4 text-sm text-ink-soft">
        Todos los warns del clan agrupados por jugador. Busca por nombre, tag o motivo; con
        &ldquo;Todos&rdquo; ves también los caducados y resueltos. El umbral para &ldquo;A echar&rdquo;
        es {cfg.threshold} warns vigentes; caducan a los {cfg.expiryDays === 0 ? "∞" : `${cfg.expiryDays} días`}.
      </p>
      <WarnsBrowser groups={groups} threshold={cfg.threshold} />
    </AppShell>
  );
}
