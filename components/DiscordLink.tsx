"use client";

import { useState } from "react";
import type { DiscordMember } from "@/lib/discord";
import { setMemberDiscord } from "@/app/miembros/actions";

// Vinculación manual de la cuenta de Discord de un miembro (la hace el líder /
// colíder). Desplegable con los miembros del servidor de Discord.
export function DiscordLink({
  tag,
  initialId,
  initialUsername,
  members,
}: {
  tag: string;
  initialId: string | null;
  initialUsername: string | null;
  members: DiscordMember[];
}) {
  const [id, setId] = useState<string | null>(initialId);
  const [username, setUsername] = useState<string | null>(initialUsername);
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState(initialId ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const m = members.find((x) => x.id === choice);
    setSaving(true);
    const r = await setMemberDiscord(tag, choice, m?.username ?? "");
    setSaving(false);
    if (r.ok) {
      setId(choice || null);
      setUsername(choice ? (m?.username ?? null) : null);
      setEditing(false);
    }
  }

  async function unlink() {
    setSaving(true);
    const r = await setMemberDiscord(tag, "", "");
    setSaving(false);
    if (r.ok) {
      setId(null);
      setUsername(null);
      setChoice("");
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-1 flex items-center gap-2">
        {id ? (
          <span className="text-sm font-bold text-ink">🎮 {username ?? id}</span>
        ) : (
          <span className="text-sm text-ink-soft">Sin vincular</span>
        )}
        <button
          onClick={() => {
            setChoice(id ?? "");
            setEditing(true);
          }}
          className="text-xs font-bold text-ink-soft underline transition hover:text-ink"
        >
          {id ? "cambiar" : "vincular"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-2">
      {members.length === 0 ? (
        <p className="text-xs text-banner">
          No se pudo cargar la lista de Discord (revisa el bot y el intent de miembros).
        </p>
      ) : (
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
        >
          <option value="">— Elige su Discord —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} (@{m.username})
            </option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !choice}
          className="rounded-full bg-gold px-3 py-1 text-xs font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {id && (
          <button
            onClick={unlink}
            disabled={saving}
            className="rounded-full px-3 py-1 text-xs font-bold text-banner transition hover:bg-banner/10"
          >
            Desvincular
          </button>
        )}
        <button
          onClick={() => setEditing(false)}
          className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-surface-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
