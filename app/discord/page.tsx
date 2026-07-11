import { getGuildMembers, getGuildRoles, getGuildChannels, getDefaultChannelId } from "@/lib/discord";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { DiscordComposer } from "@/components/DiscordComposer";
import { SettingsChannels } from "@/components/SettingsChannels";
import { PublishClanCard } from "@/components/PublishClanCard";
import { AnnounceComposer } from "@/components/AnnounceComposer";

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
      <div className="mb-4">
        <SettingsChannels channels={channels} roles={roles} current={current} />
      </div>

      <div className="mb-4">
        <PublishClanCard />
      </div>

      <div className="mb-4">
        <AnnounceComposer channels={channels} defaultChannelId={current["announcements_channel_id"] || null} />
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
