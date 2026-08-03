"use client";

import { useState } from "react";
import { addWarn, resolveWarn, compensateWarns } from "@/app/miembros/actions";
import { WARN_PRESETS, COMPENSATION_PRESETS } from "@/lib/warn-presets";

export interface WarnItem {
  id: number;
  reason: string;
  createdBy: string | null;
  createdAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  status: "vigente" | "caducado" | "resuelto";
}

const who = (email: string | null) => (email ? email.split("@")[0] : "alguien");
const shortDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "Europe/Madrid" }).format(
        new Date(iso),
      )
    : "";

export function MemberWarns({
  tag,
  threshold,
  initial,
  accounts = [],
}: {
  tag: string;
  threshold: number;
  initial: { vigentes: WarnItem[]; caducados: WarnItem[]; resueltos: WarnItem[] };
  // Cuentas del mismo jugador (principal + secundarias): la sanción puede
  // aplicarse sobre otra de sus cuentas (p. ej. degradar la principal).
  accounts?: { tag: string; name: string }[];
}) {
  const [vigentes, setVigentes] = useState<WarnItem[]>(initial.vigentes);
  const [caducados, setCaducados] = useState<WarnItem[]>(initial.caducados);
  const [resueltos, setResueltos] = useState<WarnItem[]>(initial.resueltos);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveText, setResolveText] = useState("");
  // Compensación: saldar todos los vigentes aplicando otra sanción.
  const [compOpen, setCompOpen] = useState(false);
  const [compText, setCompText] = useState("");
  const [compOn, setCompOn] = useState(tag); // sobre qué cuenta se aplicó
  const [compMsg, setCompMsg] = useState<string | null>(null);

  async function doCompensate() {
    if (!compText.trim()) return;
    setBusy(true);
    const target = accounts.find((a) => a.tag === compOn);
    const r = await compensateWarns(tag, compText, {
      tag: compOn,
      name: target?.name ?? null,
    });
    setBusy(false);
    if (!r.ok) {
      setCompMsg(r.error ?? "No se pudo compensar.");
      return;
    }
    // Los vigentes pasan a resueltos con la misma resolución.
    const now = new Date().toISOString();
    const saldados = vigentes.map((w) => ({
      ...w,
      status: "resuelto" as const,
      resolvedBy: r.by ?? null,
      resolvedAt: r.at ?? now,
      resolution: r.resolution ?? null,
    }));
    setResueltos((s) => [...saldados, ...s]);
    setVigentes([]);
    setCompOpen(false);
    setCompText("");
    setCompMsg(null);
  }

  async function add() {
    const reason = draft.trim();
    if (!reason || busy) return;
    setBusy(true);
    const r = await addWarn(tag, reason);
    setBusy(false);
    if (r.ok && r.warn) {
      setVigentes((v) => [
        {
          id: r.warn!.id,
          reason: r.warn!.reason,
          createdBy: r.warn!.createdBy,
          createdAt: r.warn!.createdAt,
          resolvedBy: null,
          resolvedAt: null,
          resolution: null,
          status: "vigente",
        },
        ...v,
      ]);
      setDraft("");
    }
  }

  async function doResolve(w: WarnItem) {
    if (busy) return;
    setBusy(true);
    const r = await resolveWarn(w.id, resolveText);
    setBusy(false);
    if (r.ok) {
      const resolved: WarnItem = {
        ...w,
        status: "resuelto",
        resolvedBy: r.by ?? null,
        resolvedAt: r.at ?? null,
        resolution: resolveText.trim() || null,
      };
      setVigentes((v) => v.filter((x) => x.id !== w.id));
      setCaducados((c) => c.filter((x) => x.id !== w.id));
      setResueltos((s) => [resolved, ...s]);
      setResolvingId(null);
      setResolveText("");
    }
  }

  const overLimit = vigentes.length >= threshold;

  function WarnRow({ w, muted }: { w: WarnItem; muted?: boolean }) {
    return (
      <li className={`rounded-xl border border-line p-2.5 ${muted ? "opacity-60" : "bg-surface-2/40"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{w.reason}</p>
            <p className="text-[11px] text-ink-soft">
              {who(w.createdBy)} · {shortDate(w.createdAt)}
              {w.status === "caducado" && (
                <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 font-bold">caducado</span>
              )}
            </p>
          </div>
          {resolvingId !== w.id && (
            <button
              onClick={() => {
                setResolvingId(w.id);
                setResolveText("");
              }}
              className="flex-none rounded-full border border-line px-3 py-1 text-xs font-extrabold text-ink-soft hover:bg-surface-2"
            >
              Resolver
            </button>
          )}
        </div>
        {resolvingId === w.id && (
          <div className="mt-2 flex items-center gap-2">
            <input
              value={resolveText}
              onChange={(e) => setResolveText(e.target.value)}
              placeholder="Desenlace (hablado, mejoró, expulsado, anulado…)"
              maxLength={300}
              autoFocus
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
            />
            <button
              onClick={() => doResolve(w)}
              disabled={busy}
              className="flex-none rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-banner-dark disabled:opacity-50"
            >
              {busy ? "…" : "Guardar"}
            </button>
            <button
              onClick={() => setResolvingId(null)}
              className="flex-none rounded-full px-2 py-1.5 text-xs font-bold text-ink-soft hover:bg-surface-2"
            >
              ✕
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-3">
      {/* Vigentes */}
      {vigentes.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Activos ({vigentes.length})
            {overLimit && (
              <span className="rounded-full bg-banner/15 px-2 py-0.5 text-[10px] font-extrabold text-banner">
                supera el límite ({vigentes.length}/{threshold}) · candidato a echar
              </span>
            )}
          </p>
          <ul className="space-y-1.5">
            {vigentes.map((w) => (
              <WarnRow key={w.id} w={w} />
            ))}
          </ul>

          {/* Compensar: aplicar otra sanción y saldar todos los warns vigentes */}
          {!compOpen ? (
            <button
              onClick={() => {
                setCompOpen(true);
                setCompMsg(null);
              }}
              className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2"
            >
              ⚖️ Compensar warns con otra sanción
            </button>
          ) : (
            <div className="mt-2 rounded-xl border border-gold/40 bg-gold/5 p-3">
              <p className="mb-2 text-xs text-ink-soft">
                En vez de expulsar, aplica otra medida: los {vigentes.length} warns vigentes quedan
                <strong className="text-ink"> saldados</strong> y se guarda qué se hizo.
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {COMPENSATION_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setCompText(p)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                      compText === p
                        ? "bg-gold text-banner-dark"
                        : "bg-surface-2 text-ink-soft hover:bg-line"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                value={compText}
                onChange={(e) => setCompText(e.target.value)}
                placeholder="Sanción aplicada…"
                maxLength={200}
                className="mb-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
              />
              {accounts.length > 1 && (
                <label className="mb-2 flex items-center gap-2 text-xs text-ink-soft">
                  <span className="flex-none font-bold">Aplicada a</span>
                  <select
                    value={compOn}
                    onChange={(e) => setCompOn(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm font-bold text-ink outline-none focus:border-gold"
                  >
                    {accounts.map((a) => (
                      <option key={a.tag} value={a.tag}>
                        {a.name}
                        {a.tag === tag ? " (esta cuenta)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={doCompensate}
                  disabled={busy || !compText.trim()}
                  className="rounded-full bg-gold px-4 py-1.5 text-xs font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
                >
                  {busy ? "…" : `Compensar ${vigentes.length}`}
                </button>
                <button
                  onClick={() => setCompOpen(false)}
                  className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-surface-2"
                >
                  Cancelar
                </button>
                {compMsg && <span className="text-xs font-bold text-banner">{compMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Añadir */}
      <div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Motivo del warn…"
          className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {WARN_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setDraft(p)}
              className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-ink-soft hover:bg-line"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            onClick={add}
            disabled={busy || !draft.trim()}
            className="rounded-full bg-banner px-4 py-2 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Guardando…" : "⚠️ Poner warn"}
          </button>
        </div>
      </div>

      {/* Caducados */}
      {caducados.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Caducados ({caducados.length}) · ya no cuentan
          </p>
          <ul className="space-y-1.5">
            {caducados.map((w) => (
              <WarnRow key={w.id} w={w} muted />
            ))}
          </ul>
        </div>
      )}

      {/* Historial (resueltos) */}
      {resueltos.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Historial ({resueltos.length})
          </p>
          <ul className="space-y-1.5">
            {resueltos.map((w) => (
              <li key={w.id} className="rounded-xl border border-line p-2.5 opacity-75">
                <p className="text-sm font-semibold text-ink">{w.reason}</p>
                <p className="text-[11px] text-ink-soft">
                  {who(w.createdBy)} · {shortDate(w.createdAt)} → ✓ resuelto por {who(w.resolvedBy)} ·{" "}
                  {shortDate(w.resolvedAt)}
                  {w.resolution && <> · {w.resolution}</>}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {vigentes.length === 0 && caducados.length === 0 && resueltos.length === 0 && (
        <p className="text-sm text-ink-soft">Sin warns. Este miembro está limpio 👌</p>
      )}
    </div>
  );
}
