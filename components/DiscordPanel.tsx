"use client";

import { useState } from "react";
import { Send, Megaphone, Settings } from "lucide-react";
import type { DiscordMember, DiscordRole, DiscordChannel } from "@/lib/discord";
import { DiscordComposer } from "@/components/DiscordComposer";
import { AnnounceComposer } from "@/components/AnnounceComposer";
import { SettingsChannels } from "@/components/SettingsChannels";
import { PublishClanCard } from "@/components/PublishClanCard";

type Tab = "mensaje" | "anuncio" | "ajustes";

export function DiscordPanel({
  members,
  roles,
  channels,
  defaultChannel,
  current,
}: {
  members: DiscordMember[];
  roles: DiscordRole[];
  channels: DiscordChannel[];
  defaultChannel: string | null;
  current: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>("mensaje");

  const tabs: { id: Tab; label: string; icon: typeof Send }[] = [
    { id: "mensaje", label: "Mensaje", icon: Send },
    { id: "anuncio", label: "Anuncio", icon: Megaphone },
    { id: "ajustes", label: "Ajustes", icon: Settings },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                tab === t.id ? "bg-gold text-banner-dark" : "text-ink-soft hover:bg-surface-2"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "mensaje" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            Escribe un mensaje, elige el canal y a quién etiquetar. Se publica al instante.
          </p>
          <DiscordComposer
            members={members}
            roles={roles}
            channels={channels}
            defaultChannelId={defaultChannel}
          />
        </div>
      )}

      {tab === "anuncio" && (
        <AnnounceComposer
          channels={channels}
          defaultChannelId={current["announcements_channel_id"] || null}
        />
      )}

      {tab === "ajustes" && (
        <div className="space-y-4">
          <SettingsChannels channels={channels} roles={roles} current={current} />
          <PublishClanCard />
        </div>
      )}
    </div>
  );
}
