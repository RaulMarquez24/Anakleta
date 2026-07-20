"use client";

import { useRef, useState } from "react";
import { Pencil, Eye, Send } from "lucide-react";
import { saveRulesText, publishRules } from "@/app/normas/actions";

export interface RuleTextView {
  key: string;
  title: string;
  value: string;
}
export interface TokenLegend {
  token: string;
  label: string;
  value: number;
}

const SHORT: Record<string, string> = {
  rules_general: "Generales",
  rules_war: "Guerras",
  rules_cwl: "CWL",
};

// Sustituye {token} por su valor actual (espejo cliente de applyRuleTokens).
function resolveTokens(text: string, tokens: Record<string, number>): string {
  return text.replace(/\{([a-z_]+)\}/g, (m, tok: string) =>
    tok in tokens ? String(tokens[tok]) : m,
  );
}

// Render mínimo de Discord-markdown: **negrita** y *cursiva*, respetando saltos
// e indentación (el contenedor usa whitespace-pre-wrap).
function renderMd(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

export function RulesTextEditor({
  blocks,
  discordReady,
  tokens,
  legend,
}: {
  blocks: RuleTextView[];
  discordReady: boolean;
  tokens: Record<string, number>;
  legend: TokenLegend[];
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(blocks.map((b) => [b.key, b.value])),
  );
  const [active, setActive] = useState<string>(blocks[0]?.key ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const block = blocks.find((b) => b.key === active) ?? blocks[0];
  const value = values[active] ?? "";
  const dirty = value !== (block?.value ?? "");

  function insertToken(token: string) {
    const el = taRef.current;
    const tok = `{${token}}`;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const next = value.slice(0, start) + tok + value.slice(end);
    setValues((v) => ({ ...v, [active]: next }));
    if (el) {
      const pos = start + tok.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    }
  }

  async function saveActive() {
    setBusy("save");
    setMsg(null);
    const r = await saveRulesText({ [active]: value });
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: "Guardado." } : { ok: false, text: r.error ?? "Error." });
    if (r.ok) setEditing(false);
  }

  async function publish(keys?: string[]) {
    setBusy(keys ? "one" : "all");
    setMsg(null);
    await saveRulesText({ [active]: value }); // guarda lo que ves antes de publicar
    const r = await publishRules(keys);
    setBusy(null);
    setMsg(
      r.ok
        ? { ok: true, text: `Publicado (${r.sent} ${r.sent === 1 ? "bloque" : "bloques"}).` }
        : { ok: false, text: r.error ?? "No se pudo publicar." },
    );
  }

  return (
    <div>
      {/* Pestañas */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {blocks.map((b) => (
          <button
            key={b.key}
            onClick={() => {
              setActive(b.key);
              setEditing(false);
              setMsg(null);
            }}
            className={`rounded-xl px-2 py-2 text-sm font-extrabold transition ${
              active === b.key ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
            }`}
          >
            {SHORT[b.key] ?? b.title}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {/* Cabecera del bloque activo */}
        <div className="flex items-center justify-between gap-2 border-b border-line p-3">
          <span className="truncate font-extrabold text-ink">{block?.title}</span>
          <div className="flex flex-none items-center gap-1.5">
            <button
              onClick={() => setEditing((e) => !e)}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-line"
            >
              {editing ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editing ? "Ver" : "Editar"}
            </button>
            <button
              onClick={() => publish([active])}
              disabled={!discordReady || busy != null}
              title={discordReady ? "Publicar este bloque en Discord" : "Discord no configurado"}
              className="flex items-center gap-1.5 rounded-full bg-[#5865F2] px-3 py-1.5 text-xs font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {busy === "one" ? "…" : "Publicar"}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="p-3">
            {/* Tokens clicables */}
            {legend.length > 0 && (
              <div className="mb-2">
                <p className="mb-1.5 text-[11px] font-bold text-ink-soft">
                  Toca para insertar (se sustituye por su valor al publicar):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {legend.map((l) => (
                    <button
                      key={l.token}
                      type="button"
                      onClick={() => insertToken(l.token)}
                      title={`${l.label} = ${l.value}`}
                      className="rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-gold/15"
                    >
                      <code className="text-gold-deep">{`{${l.token}}`}</code>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValues((v) => ({ ...v, [active]: e.target.value }))}
              rows={16}
              className="w-full resize-y rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs text-ink outline-none focus:border-gold"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-ink-soft">
                {value.length} / 1990 caracteres
              </span>
              <button
                onClick={saveActive}
                disabled={busy != null || !dirty}
                className="rounded-full bg-gold px-4 py-1.5 text-xs font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
              >
                {busy === "save" ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        ) : (
          /* Vista renderizada (markdown, tokens resueltos) */
          <div
            className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink [&_strong]:text-ink [&_strong]:font-extrabold"
            dangerouslySetInnerHTML={{ __html: renderMd(resolveTokens(value, tokens)) }}
          />
        )}
      </div>

      {/* Acciones globales */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => publish()}
          disabled={!discordReady || busy != null}
          title={discordReady ? "Publicar las 3 normas en Discord" : "Discord no configurado"}
          className="flex items-center gap-1.5 rounded-full bg-[#5865F2] px-5 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {busy === "all" ? "Publicando…" : "Publicar todo en Discord"}
        </button>
        {msg && (
          <span className={`text-sm font-bold ${msg.ok ? "text-grass" : "text-banner"}`}>
            {msg.text}
          </span>
        )}
      </div>
      {!discordReady && (
        <p className="mt-2 text-xs text-ink-soft">
          Para publicar, configura el bot y el canal de reglas o de anuncios en el panel de Discord.
        </p>
      )}
    </div>
  );
}
