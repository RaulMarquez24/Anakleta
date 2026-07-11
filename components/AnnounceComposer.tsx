"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import type { DiscordChannel } from "@/lib/discord";
import { publishAnnouncement } from "@/app/discord/actions";

const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold";

export function AnnounceComposer({
  channels,
  defaultChannelId,
}: {
  channels: DiscordChannel[];
  defaultChannelId: string | null;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [mention, setMention] = useState<"none" | "everyone" | "clan">("none");
  const [channelId, setChannelId] = useState(defaultChannelId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function publish() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await publishAnnouncement({ title, body, url, imageUrl, mention, channelId });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: "Anuncio publicado." });
      setTitle("");
      setBody("");
      setUrl("");
      setImageUrl("");
      setMention("none");
    } else {
      setMsg({ ok: false, text: r.error ?? "No se pudo." });
    }
  }

  const disabled = busy || (!title.trim() && !body.trim()) || !channelId;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 font-extrabold text-ink">
        <Megaphone className="h-4 w-4 text-ink-soft" />
        Anuncio
      </h2>

      <div className="space-y-2.5">
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (ej.: Evento en la tienda)"
          maxLength={240}
        />
        <textarea
          className={`${inputCls} resize-none`}
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Mensaje del anuncio. Puedes usar **negrita**, saltos de línea y emojis."
        />
        <input
          className={inputCls}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enlace opcional (https://…) → aparece como botón «Abrir»"
        />
        <input
          className={inputCls}
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Imagen opcional (URL https://…) → se muestra grande"
        />
        {imageUrl.trim() && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="max-h-40 w-full rounded-lg border border-line object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            <option value="">— elige canal —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={mention}
            onChange={(e) => setMention(e.target.value as "none" | "everyone" | "clan")}
            className="rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            <option value="none">Sin avisar</option>
            <option value="clan">Avisar @Clan</option>
            <option value="everyone">Avisar @everyone</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          {msg ? (
            <p className={`text-xs font-semibold ${msg.ok ? "text-grass" : "text-banner"}`}>
              {msg.ok ? "✓ " : "✕ "}
              {msg.text}
            </p>
          ) : (
            <span />
          )}
          <button
            onClick={publish}
            disabled={disabled}
            className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? "Publicando…" : "Publicar anuncio"}
          </button>
        </div>
      </div>
    </div>
  );
}
