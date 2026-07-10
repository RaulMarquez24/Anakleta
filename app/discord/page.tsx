import { getGuildMembers, getGuildRoles } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { DiscordComposer } from "@/components/DiscordComposer";

export const dynamic = "force-dynamic";

export default async function DiscordPage() {
  const [user, members, roles] = await Promise.all([
    getCurrentUser(),
    getGuildMembers().catch(() => []),
    getGuildRoles().catch(() => []),
  ]);

  return (
    <AppShell email={user?.email} title="Avisar por Discord" back="/">
      <p className="mb-4 text-sm text-ink-soft">
        Escribe un mensaje y elige a quién etiquetar. Se publica en el canal del clan al instante.
      </p>
      <DiscordComposer members={members} roles={roles} />
    </AppShell>
  );
}
