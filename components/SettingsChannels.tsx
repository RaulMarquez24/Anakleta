"use client";

import { useState } from "react";
import type { DiscordChannel, DiscordRole } from "@/lib/discord";
import { setSetting } from "@/app/discord/actions";

interface Item {
  key: string;
  label: string;
  hint?: string;
  kind: "channel" | "role";
}

const ITEMS: Item[] = [
  { key: "cwl_list_channel_id", label: "Listado de CWL", hint: "Donde vive el mensaje fijo de inscritos (#ligas-cwl).", kind: "channel" },
  { key: "cwl_announce_channel_id", label: "Avisos de CWL", hint: "Aperturas y recordatorios, con @Clan (#general).", kind: "channel" },
  { key: "welcome_channel_id", label: "Bienvenida", hint: "Saludo a quien entra si tiene los MD cerrados (#general).", kind: "channel" },
  { key: "discord_channel_id", label: "Avisos de guerra", hint: "Recordatorios de guerra (botón y cron).", kind: "channel" },
  { key: "cwl_role_id", label: "Rol CWL", hint: "Se asigna al inscribirse y se retira al terminar la liga.", kind: "role" },
  { key: "clan_role_id", label: "Rol del clan", hint: "A quién etiquetan los avisos (@Clan).", kind: "role" },
];

function Row({
  item,
  channels,
  roles,
  current,
}: {
  item: Item;
  channels: DiscordChannel[];
  roles: DiscordRole[];
  current: string;
}) {
  const options = item.kind === "channel" ? channels : roles.map((r) => ({ id: r.id, name: r.name }));
  const [value, setValue] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setErr(null);
    const r = await setSetting(item.key, value);
    setSaving(false);
    if (r.ok) setSaved(true);
    else setErr(r.error ?? "Error");
  }

  return (
    <div className="border-b border-line px-3.5 py-3 last:border-b-0">
      <p className="text-sm font-extrabold text-ink">{item.label}</p>
      {item.hint && <p className="mb-1.5 text-[11px] text-ink-soft">{item.hint}</p>}
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
        >
          <option value="">— sin asignar —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {item.kind === "role" ? `@${o.name}` : o.name}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={saving || value === current}
          className="flex-none rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-40"
        >
          {saving ? "…" : saved ? "✓" : "Guardar"}
        </button>
      </div>
      {err && <p className="mt-1 text-xs font-semibold text-banner">{err}</p>}
    </div>
  );
}

// Panel para configurar canales y roles (tabla settings) sin tocar SQL.
export function SettingsChannels({
  channels,
  roles,
  current,
}: {
  channels: DiscordChannel[];
  roles: DiscordRole[];
  current: Record<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-3.5 py-2.5">
        <p className="text-sm font-extrabold text-ink">Canales y roles</p>
        <p className="text-[11px] text-ink-soft">Se guardan al instante; el bot y los avisos los leen de aquí.</p>
      </div>
      {channels.length === 0 && roles.length === 0 ? (
        <p className="px-3.5 py-4 text-sm text-banner">No se pudieron cargar canales/roles (revisa el bot).</p>
      ) : (
        ITEMS.map((it) => (
          <Row key={it.key} item={it} channels={channels} roles={roles} current={current[it.key] ?? ""} />
        ))
      )}
    </div>
  );
}
