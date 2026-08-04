"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createEvent, closeEvent, reopenEvent, setParticipants } from "@/app/eventos/actions";

export interface EventView {
  id: number;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  autoSource: string | null;
  active: boolean;
  createdAt: string;
  participants: number;
}
export interface MemberOption {
  tag: string;
  name: string;
  townHall: number | null;
}

const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(
        new Date(iso),
      )
    : "—";

// Gestión del evento del momento: crearlo, cerrarlo y marcar quién participó.
// La participación también puede llegar sola desde Discord (p. ej. las cartas).
export function EventsPanel({
  events,
  active,
  members,
  participantTags,
  bonus,
}: {
  events: EventView[];
  active: EventView | null;
  members: MemberOption[];
  participantTags: string[];
  bonus: number;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Crear
  const [name, setName] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  // Participantes
  const [marcados, setMarcados] = useState<Set<string>>(new Set(participantTags));
  const [q, setQ] = useState("");

  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = s
      ? members.filter((m) => `${m.name} ${m.tag}`.toLowerCase().includes(s))
      : members;
    // Los que participan, primero.
    return [...arr].sort((a, b) => {
      const pa = marcados.has(a.tag) ? 0 : 1;
      const pb = marcados.has(b.tag) ? 0 : 1;
      return pa - pb || a.name.localeCompare(b.name, "es");
    });
  }, [members, q, marcados]);

  async function toggle(tag: string) {
    if (!active || busy) return;
    const participa = !marcados.has(tag);
    setBusy(true);
    const r = await setParticipants(active.id, [tag], participa);
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error ?? "Error" });
      return;
    }
    setMarcados((s) => {
      const next = new Set(s);
      if (participa) next.add(tag);
      else next.delete(tag);
      return next;
    });
  }

  async function crear() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await createEvent({ name, startsAt: starts || null, endsAt: ends || null });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: "Evento creado y activo. Recarga para verlo." });
      setName("");
      setStarts("");
      setEnds("");
    } else setMsg({ ok: false, text: r.error ?? "Error" });
  }

  return (
    <div className="space-y-4">
      {/* Evento activo */}
      {active ? (
        <div className="rounded-2xl border border-grass/40 bg-grass/8 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-grass/20 px-2.5 py-0.5 text-[11px] font-extrabold text-grass">
              🎉 En curso
            </span>
            <p className="font-extrabold text-ink">{active.name}</p>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {fecha(active.startsAt)} – {fecha(active.endsAt)} · {marcados.size} participantes ·
            plus de {bonus} puntos
            {active.autoSource ? ` · se marca solo (${active.autoSource})` : ""}
          </p>
          <button
            onClick={async () => {
              setBusy(true);
              await closeEvent(active.id);
              setBusy(false);
              setMsg({ ok: true, text: "Evento cerrado. Recarga la página." });
            }}
            disabled={busy}
            className="mt-2 rounded-full border border-line px-3 py-1 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2 disabled:opacity-50"
          >
            Cerrar evento
          </button>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-soft">
          No hay ningún evento activo. Crea uno abajo cuando salga algo que merezca la pena.
        </p>
      )}

      {/* Marcar participantes (solo si hay evento activo) */}
      {active && (
        <div className="rounded-2xl border border-line bg-surface">
          <div className="border-b border-line p-3">
            <p className="text-sm font-extrabold text-ink">Quién participó</p>
            <p className="text-[11px] text-ink-soft">
              Toca para marcar o desmarcar. Si el evento tiene mecánica en Discord, se marcan solos
              al participar.
            </p>
            <label className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5">
              <Search className="h-4 w-4 flex-none text-ink-soft" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar jugador…"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
              />
            </label>
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {lista.map((m) => {
              const on = marcados.has(m.tag);
              return (
                <li key={m.tag}>
                  <button
                    onClick={() => toggle(m.tag)}
                    disabled={busy}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-surface-2/60 disabled:opacity-60 ${on ? "bg-grass/8" : ""}`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded text-[11px] font-extrabold ${on ? "bg-grass/25 text-grass" : "bg-surface-2 text-ink-soft"}`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                      {m.name}
                    </span>
                    <span className="flex-none text-[11px] font-semibold text-ink-soft">
                      TH{m.townHall ?? "—"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Crear evento */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="mb-2 text-sm font-extrabold text-ink">Nuevo evento</p>
        <p className="mb-2 text-[11px] text-ink-soft">
          Al crearlo pasa a ser el activo (solo hay uno a la vez); el anterior se cierra y conserva
          su historial.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (p. ej. Cartas del Clashiversario)"
          maxLength={120}
          className="mb-2 w-full rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="mb-2 grid grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-ink-soft">
            Empieza
            <input
              type="date"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
            />
          </label>
          <label className="text-[11px] font-bold text-ink-soft">
            Acaba
            <input
              type="date"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink outline-none focus:border-gold"
            />
          </label>
        </div>
        <button
          onClick={crear}
          disabled={busy || !name.trim()}
          className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "…" : "Crear y activar"}
        </button>
        {msg && (
          <p className={`mt-2 text-xs font-bold ${msg.ok ? "text-grass" : "text-banner"}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Historial */}
      {events.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Eventos anteriores
          </p>
          <ul className="space-y-1.5">
            {events
              .filter((e) => !e.active)
              .map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-ink">{e.name}</span>
                    <span className="block text-[11px] text-ink-soft">
                      {fecha(e.startsAt)} – {fecha(e.endsAt)} · {e.participants} participantes
                    </span>
                  </span>
                  <button
                    onClick={async () => {
                      setBusy(true);
                      await reopenEvent(e.id);
                      setBusy(false);
                      setMsg({ ok: true, text: "Reactivado. Recarga la página." });
                    }}
                    disabled={busy}
                    className="flex-none rounded-full border border-line px-2.5 py-1 text-[11px] font-extrabold text-ink-soft transition hover:bg-surface-2 disabled:opacity-50"
                  >
                    Reactivar
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
