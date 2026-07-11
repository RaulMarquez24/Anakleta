"use client";

import { useRef, useState } from "react";
import { Megaphone, ImagePlus, X } from "lucide-react";
import type { DiscordChannel } from "@/lib/discord";

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
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<"big" | "thumb">("big");
  const [mention, setMention] = useState<"none" | "everyone" | "clan">("none");
  const [channelId, setChannelId] = useState(defaultChannelId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (filePreview) URL.revokeObjectURL(filePreview);
    if (f && !f.type.startsWith("image/")) {
      setMsg({ ok: false, text: "El archivo debe ser una imagen." });
      setFile(null);
      setFilePreview(null);
      return;
    }
    if (f && f.size > 4 * 1024 * 1024) {
      setMsg({ ok: false, text: "La imagen es demasiado grande (máx. 4 MB)." });
      setFile(null);
      setFilePreview(null);
      return;
    }
    if (f) {
      setMsg(null);
      setFile(f);
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFile(null);
      setFilePreview(null);
    }
  }

  function clearFile() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function publish() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
    fd.set("url", url);
    fd.set("imageUrl", imageUrl);
    fd.set("mention", mention);
    fd.set("channelId", channelId);
    fd.set("imageSize", imageSize);
    if (file) fd.set("image", file);
    let r: { ok: boolean; error?: string };
    try {
      const res = await fetch("/api/announce", { method: "POST", body: fd });
      r = await res.json();
    } catch {
      r = { ok: false, error: "Fallo de red al publicar." };
    }
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: "Anuncio publicado." });
      setTitle("");
      setBody("");
      setUrl("");
      setImageUrl("");
      clearFile();
      setMention("none");
    } else {
      setMsg({ ok: false, text: r.error ?? "No se pudo." });
    }
  }

  const preview = filePreview || (imageUrl.trim() ? imageUrl : null);
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

        {/* Imagen: adjuntar archivo (la aloja Discord) o pegar una URL */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-none items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-2 text-sm font-extrabold text-ink transition hover:bg-line"
          >
            <ImagePlus className="h-4 w-4" />
            Adjuntar imagen
          </button>
          <input
            className={`${inputCls} flex-1`}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="…o pega una URL de imagen"
            disabled={!!file}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {preview && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt=""
              className={`rounded-lg border border-line object-cover ${
                imageSize === "thumb" ? "h-24 w-24" : "max-h-44 w-full"
              }`}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-ink-soft">Tamaño</span>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value as "big" | "thumb")}
                className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs font-semibold text-ink outline-none focus:border-gold"
              >
                <option value="big">Grande</option>
                <option value="thumb">Miniatura (ideal para capturas verticales)</option>
              </select>
              {file && (
                <button
                  type="button"
                  onClick={clearFile}
                  className="flex items-center gap-1 font-bold text-banner hover:underline"
                >
                  <X className="h-3.5 w-3.5" />
                  Quitar imagen
                </button>
              )}
            </div>
          </>
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
