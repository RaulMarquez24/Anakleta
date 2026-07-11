"use client";

import { useState } from "react";
import { addMessage, deleteMessage } from "@/app/mensajes/actions";
import {
  MAX_LEN,
  RECRUIT_TEMPLATES,
  DISCORD_TEMPLATES,
  DISCORD_INVITE,
  DEFAULT_CATEGORIES,
  type ClanMessage,
} from "@/app/mensajes/shared";

type Tab = "reclutar" | "discord" | "guardados";
const NEW_CAT = "__new";

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

const Chip = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${className || "bg-surface-2 text-ink-soft"}`}
  >
    {children}
  </span>
);

// Tarjeta de plantilla (auto-generada): reclutamiento o Discord.
function TemplateCard({
  label,
  text,
  accent,
  onUse,
}: {
  label: string;
  text: string;
  accent: "gold" | "discord";
  onUse: (t: string) => void;
}) {
  const badge =
    accent === "discord" ? "bg-[#5865F2]/20 text-[#5865F2]" : "bg-gold/20 text-gold-deep";
  return (
    <li className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="mb-1 flex items-center gap-2">
        <Chip className={badge}>{label}</Chip>
        <Chip>Auto</Chip>
        <span className="text-[11px] font-bold text-ink-soft">
          {text.length}/{MAX_LEN}
        </span>
      </div>
      <p className="text-sm text-ink">{text}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="ml-auto" />
        <button
          onClick={() => onUse(text)}
          className="flex-none rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-line"
        >
          Usar
        </button>
        <CopyBtn text={text} />
      </div>
    </li>
  );
}

export function MessagesManager({ initial }: { initial: ClanMessage[] }) {
  const [list, setList] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("reclutar");
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [newCat, setNewCat] = useState("");
  const creating = category === NEW_CAT;

  const len = text.length;
  const over = len > MAX_LEN;

  // Categorías: por defecto + las ya usadas en mensajes guardados.
  const categories = [...new Set([...DEFAULT_CATEGORIES, ...list.map((m) => m.category)])];

  async function add() {
    const cat = (creating ? newCat : category).trim() || "General";
    if (!text.trim() || over || busy) return;
    setBusy(true);
    const r = await addMessage(text, cat);
    setBusy(false);
    if (r.ok && r.message) {
      setList((l) => [r.message!, ...l]);
      setText("");
      setCategory(r.message.category);
      setNewCat("");
      setTab("guardados"); // que se vea dónde ha ido
    }
  }

  async function remove(id: number) {
    setList((l) => l.filter((m) => m.id !== id));
    await deleteMessage(id);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "reclutar", label: "Reclutar" },
    { id: "discord", label: "Discord" },
    { id: "guardados", label: `Guardados${list.length ? ` (${list.length})` : ""}` },
  ];

  const who = (email: string | null) => (email ? email.split("@")[0] : "alguien");

  return (
    <div className="space-y-4">
      {/* Compositor (siempre visible) */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Ej.: Buscamos TH15+ activos para CWL y guerras diarias. ¡Únete!"
          className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />

        {/* Categoría (para cuando guardas) */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-bold text-ink-soft">Categoría</span>
          {creating ? (
            <>
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="Nueva categoría"
                maxLength={40}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
              />
              <button
                onClick={() => {
                  setCategory(DEFAULT_CATEGORIES[0]);
                  setNewCat("");
                }}
                aria-label="Cancelar nueva categoría"
                className="flex-none rounded-full px-2 py-1 text-sm font-bold text-ink-soft hover:bg-surface-2"
              >
                ✕
              </button>
            </>
          ) : (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-ink outline-none focus:border-gold"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CAT}>＋ Nueva categoría…</option>
            </select>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs font-extrabold ${over ? "text-banner" : "text-ink-soft"}`}>
            {len}/{MAX_LEN}
          </span>
          <div className="flex items-center gap-2">
            {text && <CopyBtn text={text} />}
            <button
              onClick={add}
              disabled={busy || over || !text.trim() || (creating && !newCat.trim())}
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

      {/* Pestañas: una lista a la vez, sin scroll eterno */}
      <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
              tab === t.id ? "bg-gold text-banner-dark" : "text-ink-soft hover:bg-surface-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Reclutar */}
      {tab === "reclutar" && (
        <ul className="space-y-2">
          {RECRUIT_TEMPLATES.map((t) => (
            <TemplateCard key={t.label} label={t.label} text={t.text} accent="gold" onUse={setText} />
          ))}
        </ul>
      )}

      {/* Discord */}
      {tab === "discord" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-3.5">
            <span className="truncate font-mono text-sm text-ink">{DISCORD_INVITE}</span>
            <span className="ml-auto" />
            <CopyBtn text={DISCORD_INVITE} />
          </div>
          <ul className="space-y-2">
            {DISCORD_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.label}
                label={t.label}
                text={t.text}
                accent="discord"
                onUse={setText}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Guardados (agrupados por categoría) */}
      {tab === "guardados" &&
        (list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-center text-sm text-ink-soft">
            Aún no has guardado ningún mensaje. Escribe uno arriba, elige categoría y dale a Guardar.
          </p>
        ) : (
          <div className="space-y-4">
            {categories
              .map((cat) => ({ cat, msgs: list.filter((m) => m.category === cat) }))
              .filter((g) => g.msgs.length > 0)
              .map(({ cat, msgs }) => (
                <div key={cat}>
                  <p className="mb-1.5 px-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
                    {cat} ({msgs.length})
                  </p>
                  <ul className="space-y-2">
                    {msgs.map((m) => (
                      <li key={m.id} className="rounded-2xl border border-line bg-surface p-3.5">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Chip className="bg-grass/15 text-grass">Guardado</Chip>
                          <span className="text-[11px] text-ink-soft">por {who(m.createdBy)}</span>
                          <span className="text-[11px] font-bold text-ink-soft">
                            {m.text.length}/{MAX_LEN}
                          </span>
                        </div>
                        <p className="text-sm text-ink">{m.text}</p>
                        <div className="mt-2 flex items-center gap-2">
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
                </div>
              ))}
          </div>
        ))}
    </div>
  );
}
