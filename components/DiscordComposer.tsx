"use client";

import { useMemo, useState } from "react";
import type { DiscordMember, DiscordRole } from "@/lib/discord";
import { sendCustomMessage } from "@/app/discord/actions";

export function DiscordComposer({
  members,
  roles,
}: {
  members: DiscordMember[];
  roles: DiscordRole[];
}) {
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; error?: string } | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) => m.label.toLowerCase().includes(t) || m.username.toLowerCase().includes(t));
  }, [members, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    setBusy(true);
    setRes(null);
    const r = await sendCustomMessage(text, [...selected], role);
    setBusy(false);
    setRes(r);
    if (r.ok) {
      setText("");
      setSelected(new Set());
      setRole("");
      setQ("");
    }
  }

  return (
    <div className="space-y-4">
      {/* Mensaje */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-soft">
          Mensaje
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={1800}
          placeholder="Escribe el aviso para el clan…"
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
      </div>

      {/* Etiquetar rol */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-soft">
          Etiquetar rol (opcional)
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
        >
          <option value="">— Ninguno —</option>
          <option value="everyone">@everyone (todos)</option>
          <option value="here">@here (conectados)</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              @{r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Etiquetar miembros */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wide text-ink-soft">
            Etiquetar miembros
          </label>
          {selected.size > 0 && (
            <span className="text-xs font-extrabold text-gold-deep">{selected.size} elegidos</span>
          )}
        </div>
        {members.length === 0 ? (
          <p className="text-xs text-banner">
            No se pudo cargar la lista de Discord (revisa el bot y el intent de miembros).
          </p>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="mb-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {filtered.map((m) => {
                const on = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                      on ? "bg-gold/20 font-bold text-ink" : "text-ink-soft hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                        on ? "border-gold bg-gold text-banner-dark" : "border-line"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="truncate">
                      {m.label} <span className="text-ink-soft/70">@{m.username}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <button
        onClick={send}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#5865F2] px-4 py-3 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? "Enviando…" : "🔔 Enviar a Discord"}
      </button>
      {res && (
        <p className={`text-center text-sm font-bold ${res.ok ? "text-grass" : "text-banner"}`}>
          {res.ok ? "✓ Enviado al canal del clan." : `✕ ${res.error}`}
        </p>
      )}
    </div>
  );
}
