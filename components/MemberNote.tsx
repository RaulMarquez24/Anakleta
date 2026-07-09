"use client";

import { useState } from "react";
import { setMemberNote } from "@/app/miembros/actions";

// "raul@x.com" -> "raul"; fecha corta.
function who(email: string | null): string {
  if (!email) return "";
  return email.split("@")[0];
}
function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "Europe/Madrid" }).format(
    new Date(iso),
  );
}

// Comentario manual opcional para cualquier miembro (activo o ex), con autor.
export function MemberNote({
  tag,
  initialNote,
  initialBy = null,
  initialAt = null,
  placeholder = "Ej.: buen atacante / avisar de guerra / a prueba…",
}: {
  tag: string;
  initialNote: string | null;
  initialBy?: string | null;
  initialAt?: string | null;
  placeholder?: string;
}) {
  const [note, setNote] = useState(initialNote ?? "");
  const [by, setBy] = useState<string | null>(initialBy);
  const [at, setAt] = useState<string | null>(initialAt);
  const [draft, setDraft] = useState(initialNote ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const r = await setMemberNote(tag, draft);
    setSaving(false);
    if (r.ok) {
      setNote(draft.trim());
      setBy(r.by ?? null);
      setAt(r.at ?? null);
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
          placeholder={placeholder}
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
    const meta = [who(by), shortDate(at)].filter(Boolean).join(" · ");
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-1.5 block text-left text-xs text-ink-soft transition hover:text-ink"
        title="Editar nota"
      >
        📝 {note}
        {meta && <span className="text-ink-soft/70"> — {meta}</span>}{" "}
        <span className="text-ink-soft/70 underline">editar</span>
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
