import { getGuildMembers, getGuildRoles, getGuildChannels, getDefaultChannelId } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { DiscordComposer } from "@/components/DiscordComposer";
import { DefaultChannelSetting } from "@/components/DefaultChannelSetting";

export const dynamic = "force-dynamic";

export default async function DiscordPage() {
  const [user, members, roles, channels, defaultChannel] = await Promise.all([
    getCurrentUser(),
    getGuildMembers().catch(() => []),
    getGuildRoles().catch(() => []),
    getGuildChannels().catch(() => []),
    getDefaultChannelId().catch(() => null),
  ]);

  return (
    <AppShell email={user?.email} title="Avisar por Discord" back="/">
      <div className="mb-4">
        <DefaultChannelSetting channels={channels} current={defaultChannel} />
      </div>

      <p className="mb-4 text-sm text-ink-soft">
        Escribe un mensaje, elige el canal y a quién etiquetar. Se publica al instante.
      </p>
      <DiscordComposer
        members={members}
        roles={roles}
        channels={channels}
        defaultChannelId={defaultChannel}
      />
    </AppShell>
  );
}
