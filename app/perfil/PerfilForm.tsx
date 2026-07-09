"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { linkPlayerTag, type LinkResult } from "./actions";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-gold";
const btnCls =
  "rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50";

export function PerfilForm({
  email,
  linkedTag,
  linkedName,
}: {
  email: string | null;
  linkedTag: string | null;
  linkedName: string | null;
}) {
  return (
    <div className="space-y-4">
      {email && (
        <p className="text-sm text-ink-soft">
          Sesión: <span className="font-bold text-ink">{email}</span>
        </p>
      )}
      <LinkTagCard linkedTag={linkedTag} linkedName={linkedName} />
      <PasswordCard />
    </div>
  );
}

function LinkTagCard({
  linkedTag,
  linkedName,
}: {
  linkedTag: string | null;
  linkedName: string | null;
}) {
  const [tag, setTag] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [relink, setRelink] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = await linkPlayerTag(tag, token);
      setResult(r);
      if (r.ok) {
        setToken("");
        setRelink(false);
      }
    } finally {
      setBusy(false);
    }
  }

  const alreadyLinked = linkedTag && !relink && !result?.ok;

  return (
    <Card title="Tu jugador de Clash">
      {alreadyLinked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-grass/15 px-3 py-1 text-sm font-extrabold text-grass">
              ✓ Vinculado
            </span>
            <span className="font-mono text-sm font-bold text-ink">{linkedTag}</span>
            {linkedName && <span className="text-sm text-ink-soft">· {linkedName}</span>}
          </div>
          <button onClick={() => setRelink(true)} className="text-xs font-bold text-ink-soft underline">
            Cambiar / volver a vincular
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-ink-soft">
            Vincula tu cuenta con tu jugador. En el juego:{" "}
            <b>Ajustes → Más ajustes → Token API</b>, cópialo (dura poco) y pégalo aquí junto a tu tag.
          </p>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-soft">Tu tag</label>
            <input
              className={inputCls}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="#ABC123"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-soft">Token del juego</label>
            <input
              className={inputCls}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="token de un solo uso"
            />
          </div>
          <button type="submit" disabled={busy} className={btnCls}>
            {busy ? "Verificando…" : "Verificar y vincular"}
          </button>
        </form>
      )}

      {result && (
        <p className={`mt-3 text-sm font-bold ${result.ok ? "text-grass" : "text-banner"}`}>
          {result.ok
            ? `✓ ${result.message} ${result.name ?? result.tag ?? ""}`.trim()
            : `✕ ${result.message}`}
        </p>
      )}
    </Card>
  );
}

function PasswordCard() {
  const [supabase] = useState(() => createBrowserClient());
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "Mínimo 8 caracteres." });
    if (pw !== pw2) return setMsg({ ok: false, text: "Las contraseñas no coinciden." });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setPw("");
    setPw2("");
    setMsg({ ok: true, text: "Contraseña actualizada." });
  }

  return (
    <Card title="Cambiar contraseña">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-ink-soft">Nueva contraseña</label>
          <input
            type="password"
            className={inputCls}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="mínimo 8 caracteres"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-ink-soft">Repítela</label>
          <input
            type="password"
            className={inputCls}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy} className={btnCls}>
          {busy ? "Guardando…" : "Actualizar contraseña"}
        </button>
      </form>
      {msg && (
        <p className={`mt-3 text-sm font-bold ${msg.ok ? "text-grass" : "text-banner"}`}>
          {msg.ok ? "✓ " : "✕ "}
          {msg.text}
        </p>
      )}
    </Card>
  );
}
