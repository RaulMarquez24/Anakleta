"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Eye, Send, Clock } from "lucide-react";
import { saveRulesText, publishRules } from "@/app/normas/actions";

const COOLDOWN_MS = 7 * 60_000;
function mmss(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface RuleTextView {
  key: string;
  title: string;
  value: string;
  def: string; // texto por defecto (para "Restablecer")
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
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Mención de canal de Discord: <#id> → chip #canal (en Discord se enlaza solo).
    .replace(
      /&lt;#(\d+)&gt;/g,
      '<span class="rounded bg-sky/15 px-1 font-bold text-sky">#canal</span>',
    );
}

export interface ChannelOption {
  id: string;
  name: string;
}

export function RulesTextEditor({
  blocks,
  discordReady,
  tokens,
  legend,
  channels,
  defaultChannel,
  lastPublishedAt,
}: {
  blocks: RuleTextView[];
  discordReady: boolean;
  tokens: Record<string, number>;
  legend: TokenLegend[];
  channels: ChannelOption[];
  defaultChannel: string | null;
  lastPublishedAt: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(blocks.map((b) => [b.key, b.value])),
  );
  const [active, setActive] = useState<string>(blocks[0]?.key ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [channelId, setChannelId] = useState<string>(defaultChannel ?? channels[0]?.id ?? "");
  const [everyone, setEveryone] = useState(false);
  const [lastPub, setLastPub] = useState<number | null>(
    lastPublishedAt ? Date.parse(lastPublishedAt) : null,
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const remaining = lastPub ? Math.max(0, COOLDOWN_MS - (nowMs - lastPub)) : 0;

  // Tic-tac de la cuenta atrás mientras haya cooldown activo.
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [remaining]);

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

  async function publish() {
    // Solo advierte si aún no han pasado los 7 min; no bloquea.
    if (remaining > 0) {
      const ok = window.confirm(
        `Aún faltan ${mmss(remaining)} para que Discord no agrupe los mensajes. ` +
          `Si publicas ahora, saldrá pegado al anterior. ¿Enviar igualmente?`,
      );
      if (!ok) return;
    }
    setBusy("one");
    setMsg(null);
    await saveRulesText({ [active]: value }); // guarda lo que ves antes de publicar
    const r = await publishRules([active], { channelId, everyone });
    setBusy(null);
    if (r.ok) {
      setMsg({ ok: true, text: `Publicado «${block?.title}».` });
      setLastPub(r.publishedAt ? Date.parse(r.publishedAt) : Date.now());
      setNowMs(Date.now());
    } else {
      setMsg({ ok: false, text: r.error ?? "No se pudo publicar." });
    }
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
              onClick={() => publish()}
              disabled={!discordReady || busy != null || !channelId}
              title={
                remaining > 0
                  ? `Aún faltan ${mmss(remaining)} para no agrupar; puedes enviar igualmente`
                  : discordReady
                    ? "Publicar este bloque en Discord"
                    : "Discord no configurado"
              }
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition disabled:opacity-50 ${
                remaining > 0
                  ? "bg-gold text-banner-dark hover:brightness-105"
                  : "bg-[#5865F2] text-white hover:brightness-110"
              }`}
            >
              {remaining > 0 ? <Clock className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {busy === "one" ? "…" : remaining > 0 ? `Publicar (${mmss(remaining)})` : "Publicar"}
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
            <p className="mt-1 text-[11px] text-ink-soft">
              Formato Discord: <code>**negrita**</code>, <code>*cursiva*</code>. Menciona un canal
              con <code>{"<#IDdelCanal>"}</code> (clic derecho en el canal → Copiar ID).
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                onClick={() => setValues((v) => ({ ...v, [active]: block?.def ?? "" }))}
                className="text-[11px] font-bold text-ink-soft underline-offset-2 hover:underline"
              >
                Restablecer texto original
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-ink-soft">
                  {value.length} / 1990
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
          </div>
        ) : (
          /* Vista renderizada (markdown, tokens resueltos) */
          <div
            className="whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink [&_strong]:text-ink [&_strong]:font-extrabold"
            dangerouslySetInnerHTML={{ __html: renderMd(resolveTokens(value, tokens)) }}
          />
        )}
      </div>

      {/* Ajustes de publicación: canal + @everyone (los usa el botón Publicar de cada pestaña) */}
      <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex-none text-xs font-bold text-ink-soft">Canal</span>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={!discordReady || channels.length === 0}
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm font-bold text-ink outline-none focus:border-gold disabled:opacity-50"
            >
              {channels.length === 0 && <option value="">(sin canales)</option>}
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-none items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-bold text-ink">
            <input
              type="checkbox"
              checked={everyone}
              onChange={(e) => setEveryone(e.target.checked)}
              className="h-4 w-4 accent-gold"
            />
            @everyone
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          Publica cada norma desde su pestaña con <strong>Publicar</strong>. Se recomienda esperar{" "}
          <strong>7 min</strong> entre una y otra para que Discord no las agrupe; si envías antes, te
          avisa pero puedes hacerlo igualmente (reinicia el contador).
          {remaining > 0 && (
            <span className="ml-1 font-bold text-gold-deep">Faltan {mmss(remaining)}.</span>
          )}
        </p>
        {everyone && (
          <p className="mt-1 text-[11px] font-semibold text-gold-deep">
            @everyone se añade oculto (spoiler): no se ve pero notifica.
          </p>
        )}
        {msg && (
          <p className={`mt-2 text-sm font-bold ${msg.ok ? "text-grass" : "text-banner"}`}>
            {msg.text}
          </p>
        )}
        {!discordReady && (
          <p className="mt-2 text-xs text-ink-soft">
            Para publicar, configura el bot de Discord en el panel de Discord.
          </p>
        )}
      </div>
    </div>
  );
}
