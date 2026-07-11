import { getGuildMembers, getGuildRoles, getGuildChannels, getDefaultChannelId } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { DiscordPanel } from "@/components/DiscordPanel";

export const dynamic = "force-dynamic";

const SETTING_KEYS = [
  "discord_channel_id",
  "cwl_list_channel_id",
  "cwl_announce_channel_id",
  "welcome_channel_id",
  "cwl_role_id",
  "clan_role_id",
  "clan_card_channel_id",
  "announcements_channel_id",
];

export default async function DiscordPage() {
  const [user, members, roles, channels, defaultChannel] = await Promise.all([
    getCurrentUser(),
    getGuildMembers().catch(() => []),
    getGuildRoles().catch(() => []),
    getGuildChannels().catch(() => []),
    getDefaultChannelId().catch(() => null),
  ]);

  // Valores actuales de settings (para el panel de canales/roles).
  const svc = createServerClient();
  const { data: settings } = await svc.from("settings").select("key, value").in("key", SETTING_KEYS);
  const current: Record<string, string> = {};
  for (const s of settings ?? []) current[s.key as string] = (s.value as string | null) ?? "";

  return (
    <AppShell email={user?.email} title="Avisar por Discord" back="/">
      <DiscordPanel
        members={members}
        roles={roles}
        channels={channels}
        defaultChannel={defaultChannel}
        current={current}
      />
    </AppShell>
  );
}
