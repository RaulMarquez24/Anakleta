"use client";

import { useState } from "react";
import { compensateExpulsion, revokeSanction } from "@/app/miembros/actions";
import { COMPENSATION_PRESETS } from "@/lib/warn-presets";
import type { Sanction } from "@/lib/sanctions";

const who = (email: string | null) => (email ? email.split("@")[0] : "alguien");
const shortDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "Europe/Madrid" }).format(
        new Date(iso),
      )
    : "";

const DURATIONS = [
  { days: 15, label: "15 días" },
  { days: 30, label: "1 mes" },
  { days: 90, label: "3 meses" },
  { days: 0, label: "Indefinida" },
];

// Compensar una propuesta de expulsión (venga de warns, inactividad, guerras…)
// aplicando otra sanción: degradar, excluir de una guerra, aviso final…
export function MemberSanction({
  tag,
  isExpulsion,
  reasons,
  accounts = [],
  activeSanction,
  history = [],
  warnsVigentes = 0,
}: {
  tag: string;
  isExpulsion: boolean; // la app propone expulsarlo ahora mismo
  reasons: string[]; // motivos actuales (se guardan como contexto)
  accounts?: { tag: string; name: string }[];
  activeSanction: Sanction | null;
  history?: Sanction[];
  warnsVigentes?: number;
}) {
  const [open, setOpen] = useState(false);
  const [sanction, setSanction] = useState("");
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [appliedTo, setAppliedTo] = useState(tag);
  const [alsoWarns, setAlsoWarns] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [current, setCurrent] = useState<Sanction | null>(activeSanction);

  async function save() {
    if (!sanction.trim()) return;
    setBusy(true);
    setMsg(null);
    const target = accounts.find((a) => a.tag === appliedTo);
    const r = await compensateExpulsion({
      tag,
      sanction,
      days,
      note,
      reasons,
      appliedTo: { tag: appliedTo, name: target?.name ?? null },
      alsoWarns: alsoWarns && warnsVigentes > 0,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error ?? "No se pudo guardar.");
      return;
    }
    setCurrent({
      id: -1,
      memberTag: tag,
      sanction: sanction.trim(),
      appliedToTag: appliedTo !== tag ? appliedTo : null,
      appliedToName: appliedTo !== tag ? (target?.name ?? null) : null,
      reasons: reasons.join(" · "),
      note: note.trim() || null,
      createdBy: null,
      createdAt: new Date().toISOString(),
      expiresAt: days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      revoked: false,
      active: true,
    });
    setOpen(false);
    setSanction("");
    setNote("");
  }

  async function revoke() {
    if (!current || current.id < 0) {
      setCurrent(null);
      return;
    }
    setBusy(true);
    const r = await revokeSanction(current.id);
    setBusy(false);
    if (r.ok) setCurrent(null);
    else setMsg(r.error ?? "No se pudo revocar.");
  }

  const pasadas = history.filter((s) => !s.active);

  return (
    <div className="space-y-2.5">
      {current ? (
        <div className="rounded-xl border border-sky/40 bg-sky/8 p-3">
          <p className="text-sm font-extrabold text-ink">⚖️ Expulsión compensada</p>
          <p className="mt-0.5 text-sm text-ink">
            {current.sanction}
            {current.appliedToName && (
              <span className="text-ink-soft"> (aplicado a {current.appliedToName})</span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-ink-soft">
            {who(current.createdBy)} · {shortDate(current.createdAt)} ·{" "}
            {current.expiresAt ? `vigente hasta ${shortDate(current.expiresAt)}` : "indefinida"}
          </p>
          {current.note && <p className="mt-1 text-xs text-ink-soft">{current.note}</p>}
          <button
            onClick={revoke}
            disabled={busy}
            className="mt-2 rounded-full border border-line px-3 py-1 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2 disabled:opacity-50"
          >
            {busy ? "…" : "Revocar compensación"}
          </button>
        </div>
      ) : !open ? (
        <button
          onClick={() => setOpen(true)}
          className={`w-full rounded-xl border py-2 text-xs font-extrabold transition ${
            isExpulsion
              ? "border-banner/50 bg-banner/8 text-banner hover:bg-banner/12"
              : "border-dashed border-line text-ink-soft hover:bg-surface-2"
          }`}
        >
          ⚖️ Compensar expulsión con otra sanción
        </button>
      ) : (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-3">
          <p className="mb-2 text-xs text-ink-soft">
            En vez de expulsar, aplica otra medida. Mientras esté vigente no se volverá a proponer su
            expulsión y quedará registrado qué se hizo.
          </p>
          {reasons.length > 0 && (
            <p className="mb-2 rounded-lg bg-surface-2/60 px-2 py-1.5 text-[11px] text-ink-soft">
              <span className="font-bold">Motivos ahora:</span> {reasons.join(" · ")}
            </p>
          )}

          <div className="mb-2 flex flex-wrap gap-1.5">
            {COMPENSATION_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setSanction(p)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  sanction === p ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            value={sanction}
            onChange={(e) => setSanction(e.target.value)}
            placeholder="Sanción aplicada…"
            maxLength={200}
            className="mb-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
          />

          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-ink-soft">Compensa durante</span>
            {DURATIONS.map((d) => (
              <button
                key={d.days}
                onClick={() => setDays(d.days)}
                className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                  days === d.days ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {accounts.length > 1 && (
            <label className="mb-2 flex items-center gap-2 text-xs text-ink-soft">
              <span className="flex-none font-bold">Aplicada a</span>
              <select
                value={appliedTo}
                onChange={(e) => setAppliedTo(e.target.value)}
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

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            maxLength={300}
            className="mb-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-gold"
          />

          {warnsVigentes > 0 && (
            <label className="mb-2 flex items-center gap-2 text-xs font-bold text-ink">
              <input
                type="checkbox"
                checked={alsoWarns}
                onChange={(e) => setAlsoWarns(e.target.checked)}
                className="h-4 w-4 accent-gold"
              />
              Saldar también sus {warnsVigentes} warn{warnsVigentes === 1 ? "" : "s"} vigente
              {warnsVigentes === 1 ? "" : "s"}
            </label>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy || !sanction.trim()}
              className="rounded-full bg-gold px-4 py-1.5 text-xs font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
            >
              {busy ? "…" : "Compensar"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-ink-soft hover:bg-surface-2"
            >
              Cancelar
            </button>
            {msg && <span className="text-xs font-bold text-banner">{msg}</span>}
          </div>
        </div>
      )}

      {/* Historial de compensaciones anteriores */}
      {pasadas.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Anteriores ({pasadas.length})
          </p>
          <ul className="space-y-1">
            {pasadas.map((s) => (
              <li key={s.id} className="rounded-lg border border-line p-2 text-[11px] text-ink-soft">
                <span className="font-bold text-ink">{s.sanction}</span> · {who(s.createdBy)} ·{" "}
                {shortDate(s.createdAt)} · {s.revoked ? "revocada" : "caducada"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
