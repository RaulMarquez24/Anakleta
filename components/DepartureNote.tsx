"use client";

import { useState } from "react";
import { setMemberNote } from "@/app/miembros/actions";

// Comentario manual opcional para un ex-miembro (p. ej. "expulsado por inactivo").
export function DepartureNote({ tag, initialNote }: { tag: string; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [draft, setDraft] = useState(initialNote ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await setMemberNote(tag, draft);
    setSaving(false);
    if (r.ok) {
      setNote(draft.trim());
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Ej.: expulsado por inactivo / se fue solo / tóxico…"
          className="w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-gold px-3 py-1 text-xs font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            onClick={() => {
              setDraft(note);
              setEditing(false);
            }}
            className="rounded-full px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-surface-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-1.5 block text-left text-xs text-ink-soft transition hover:text-ink"
        title="Editar nota"
      >
        📝 {note} <span className="text-ink-soft/70 underline">editar</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-1.5 text-xs font-bold text-ink-soft/80 underline transition hover:text-ink"
    >
      ＋ Añadir nota
    </button>
  );
}
