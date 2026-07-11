"use client";

import { useState } from "react";
import { addMessage, deleteMessage } from "@/app/mensajes/actions";
import {
  MAX_LEN,
  RECRUIT_TEMPLATES,
  DISCORD_TEMPLATES,
  DISCORD_INVITE,
  type ClanMessage,
} from "@/app/mensajes/shared";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin clipboard: el texto es seleccionable */
    }
  }
  return (
    <button
      onClick={copy}
      className="flex-none rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-banner-dark transition hover:brightness-105"
    >
      {copied ? "✓ Copiado" : "Copiar"}
    </button>
  );
}

export function MessagesManager({ initial }: { initial: ClanMessage[] }) {
  const [list, setList] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const len = text.length;
  const over = len > MAX_LEN;

  async function add() {
    if (!text.trim() || over || busy) return;
    setBusy(true);
    const r = await addMessage(text);
    setBusy(false);
    if (r.ok && r.message) {
      setList((l) => [r.message!, ...l]);
      setText("");
    }
  }

  async function remove(id: number) {
    setList((l) => l.filter((m) => m.id !== id));
    await deleteMessage(id);
  }

  return (
    <div className="space-y-4">
      {/* Compositor */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Ej.: Buscamos TH15+ activos para CWL y guerras diarias. ¡Únete!"
          className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs font-extrabold ${over ? "text-banner" : "text-ink-soft"}`}>
            {len}/{MAX_LEN}
          </span>
          <div className="flex items-center gap-2">
            {text && <CopyBtn text={text} />}
            <button
              onClick={add}
              disabled={busy || over || !text.trim()}
              className="rounded-full border border-line bg-surface-2 px-4 py-1.5 text-sm font-extrabold text-ink transition hover:bg-line disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
        {over && (
          <p className="mt-1 text-xs font-semibold text-banner">
            Te pasas por {len - MAX_LEN} carácter{len - MAX_LEN === 1 ? "" : "es"}.
          </p>
        )}
      </div>

      {/* Plantillas de reclutamiento (sugeridas) */}
      <div>
        <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
          Plantillas de reclutamiento
        </p>
        <ul className="space-y-2">
          {RECRUIT_TEMPLATES.map((t) => (
            <li key={t.label} className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-gold-deep">
                  {t.label}
                </span>
                <span className="text-[11px] font-bold text-ink-soft">{t.text.length}/{MAX_LEN}</span>
              </div>
              <p className="text-sm text-ink">{t.text}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="ml-auto" />
                <button
                  onClick={() => setText(t.text)}
                  className="flex-none rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-line"
                >
                  Usar
                </button>
                <CopyBtn text={t.text} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Invitación al Discord */}
      <div>
        <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
          Invitación al Discord
        </p>
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-line bg-surface p-3.5">
          <span className="truncate font-mono text-sm text-ink">{DISCORD_INVITE}</span>
          <span className="ml-auto" />
          <CopyBtn text={DISCORD_INVITE} />
        </div>
        <ul className="space-y-2">
          {DISCORD_TEMPLATES.map((t) => (
            <li key={t.label} className="rounded-2xl border border-line bg-surface p-3.5">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[#5865F2]/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#5865F2]">
                  {t.label}
                </span>
                <span className="text-[11px] font-bold text-ink-soft">
                  {t.text.length}/{MAX_LEN}
                </span>
              </div>
              <p className="text-sm text-ink">{t.text}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="ml-auto" />
                <button
                  onClick={() => setText(t.text)}
                  className="flex-none rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-line"
                >
                  Usar
                </button>
                <CopyBtn text={t.text} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Guardados */}
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-center text-sm text-ink-soft">
          Aún no has guardado ningún mensaje. Escribe uno arriba y dale a Guardar.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id} className="rounded-2xl border border-line bg-surface p-3.5">
              <p className="text-sm text-ink">{m.text}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] font-bold text-ink-soft">{m.text.length}/{MAX_LEN}</span>
                <span className="ml-auto" />
                <CopyBtn text={m.text} />
                <button
                  onClick={() => remove(m.id)}
                  aria-label="Borrar"
                  className="flex-none rounded-full p-1.5 text-ink-soft transition hover:bg-surface-2 hover:text-banner"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
