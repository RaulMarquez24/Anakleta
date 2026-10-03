"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, ChevronDown, Hand, Plus, Search, X } from "lucide-react";
import { closeEvent, reopenEvent, saveEvent, setParticipants } from "@/app/eventos/actions";

export interface EventDetailView {
  id: number;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  autoSource: string | null;
  active: boolean;
}
export interface ParticipantView {
  tag: string | null;
  name: string;
  discordId: string | null;
  source: string;
}
export interface MemberOption {
  tag: string;
  name: string;
  townHall: number | null;
}

const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeZone: "Europe/Madrid",
      }).format(new Date(iso))
    : "—";
// Los <input type="date"> quieren AAAA-MM-DD.
const paraInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function EventDetail({
  event,
  participants,
  members,
  bonus,
}: {
  event: EventDetailView;
  participants: ParticipantView[];
  members: MemberOption[];
  bonus: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [ajustes, setAjustes] = useState(false);
  // Ajustes
  const [name, setName] = useState(event.name);
  const [starts, setStarts] = useState(paraInput(event.startsAt));
  const [ends, setEnds] = useState(paraInput(event.endsAt));
  const [cards, setCards] = useState(event.autoSource === "cards");

  const yaEstan = useMemo(
    () => new Set(participants.map((p) => p.tag).filter((t): t is string => !!t)),
    [participants],
  );
  const candidatos = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members
      .filter((m) => !yaEstan.has(m.tag))
      .filter((m) => (s ? `${m.name} ${m.tag}`.toLowerCase().includes(s) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [members, yaEstan, q]);

  async function marcar(tag: string, participa: boolean) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const r = await setParticipants(event.id, [tag], participa);
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error ?? "Error" });
      return;
    }
    router.refresh();
  }

  async function cambiarEstado() {
    setBusy(true);
    setMsg(null);
    const r = event.active ? await closeEvent(event.id) : await reopenEvent(event.id);
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error ?? "Error" });
      return;
    }
    router.refresh();
  }

  async function guardar() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await saveEvent(event.id, {
      name,
      startsAt: starts || null,
      endsAt: ends || null,
      autoSource: cards ? "cards" : null,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error ?? "Error" });
      return;
    }
    setAjustes(false);
    router.refresh();
  }

  const auto = participants.filter((p) => p.source !== "manual").length;

  return (
    <div className="space-y-4">
      {/* Cabecera del evento */}
      <div
        className={`rounded-2xl border p-4 ${event.active ? "border-grass/40 bg-grass/8" : "border-line bg-surface"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${event.active ? "bg-grass/20 text-grass" : "bg-surface-2 text-ink-soft"}`}
          >
            {event.active ? "🎉 En curso" : "Cerrado"}
          </span>
          {event.autoSource === "cards" && (
            <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-extrabold text-ink-soft">
              <Bot className="h-3 w-3" /> se marca solo (cartas)
            </span>
          )}
        </div>
        <p className="mt-1.5 text-lg font-extrabold leading-tight text-ink">{event.name}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {fecha(event.startsAt)} – {fecha(event.endsAt)} · plus de {bonus} puntos
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2/70 p-2">
            <p className="text-lg font-extrabold leading-none text-ink">{participants.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">
              participan
            </p>
          </div>
          <div className="rounded-xl bg-surface-2/70 p-2">
            <p className="text-lg font-extrabold leading-none text-ink">{auto}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">solos</p>
          </div>
          <div className="rounded-xl bg-surface-2/70 p-2">
            <p className="text-lg font-extrabold leading-none text-ink">
              {participants.length - auto}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">a mano</p>
          </div>
        </div>
        <button
          onClick={cambiarEstado}
          disabled={busy}
          className="mt-3 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-extrabold text-ink-soft transition hover:bg-surface-2 disabled:opacity-50"
        >
          {event.active ? "Cerrar evento" : "Volver a activarlo"}
        </button>
      </div>

      {/* Quién participó */}
      <div className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-3">
          <p className="text-sm font-extrabold text-ink">Quién participó</p>
          <p className="text-[11px] text-ink-soft">
            {event.autoSource === "cards"
              ? "Se marcan solos al publicar repetidas o cerrar un cambio en Discord. Si un jugador tiene varias cuentas, cuentan todas."
              : "Este evento no tiene mecánica en Discord: márcalos a mano."}
          </p>
        </div>
        {participants.length === 0 ? (
          <p className="p-3 text-sm text-ink-soft">Todavía no participa nadie.</p>
        ) : (
          <ul className="divide-y divide-line">
            {participants.map((p) => (
              <li key={p.tag ?? `d${p.discordId}`} className="flex items-center gap-2 px-3 py-2">
                <span
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-grass/15 text-grass"
                  title={p.source === "manual" ? "Marcado a mano" : `Automático (${p.source})`}
                >
                  {p.source === "manual" ? (
                    <Hand className="h-3.5 w-3.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5" />
                  )}
                </span>
                {p.tag ? (
                  <Link
                    href={`/member/${encodeURIComponent(p.tag)}`}
                    className="min-w-0 flex-1 truncate text-sm font-bold text-ink hover:text-gold"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink-soft">
                    Discord sin vincular
                  </span>
                )}
                {p.tag && (
                  <button
                    onClick={() => marcar(p.tag!, false)}
                    disabled={busy}
                    title="Quitar del evento"
                    className="flex-none rounded-full p-1 text-ink-soft transition hover:bg-surface-2 hover:text-banner disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Añadir a mano */}
      <div className="rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-3">
          <p className="text-sm font-extrabold text-ink">Añadir participación</p>
          <p className="mb-2 text-[11px] text-ink-soft">
            Para dejar constancia de quien participó sin pasar por Discord.
          </p>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5">
            <Search className="h-4 w-4 flex-none text-ink-soft" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar jugador…"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink outline-none"
            />
          </label>
        </div>
        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
          {candidatos.length === 0 ? (
            <li className="p-3 text-sm text-ink-soft">
              {q ? "Nadie con ese nombre." : "Ya están todos marcados."}
            </li>
          ) : (
            candidatos.map((m) => (
              <li key={m.tag}>
                <button
                  onClick={() => marcar(m.tag, true)}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-surface-2/60 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4 flex-none text-ink-soft" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                    {m.name}
                  </span>
                  <span className="flex-none text-[11px] font-semibold text-ink-soft">
                    TH{m.townHall ?? "—"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Ajustes del evento */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <button
          onClick={() => setAjustes((a) => !a)}
          aria-expanded={ajustes}
          className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2/40"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
              Ajustes
            </span>
            <span className="block truncate text-sm text-ink">Nombre, fechas y automatismo</span>
          </span>
          <ChevronDown
            className={`h-5 w-5 flex-none text-ink-soft transition-transform ${ajustes ? "rotate-180" : ""}`}
          />
        </button>
        {ajustes && (
          <div className="border-t border-line p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            <label className="mb-3 flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
              <input
                type="checkbox"
                checked={cards}
                onChange={(e) => setCards(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-none accent-gold"
              />
              <span className="text-[11px] text-ink-soft">
                <strong className="text-ink">Se marca solo con las cartas de Discord.</strong> Quien
                publique repetidas o cierre un cambio queda como participante sin tocar nada.
              </span>
            </label>
            <button
              onClick={guardar}
              disabled={busy || !name.trim()}
              className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
            >
              {busy ? "…" : "Guardar"}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <p className={`text-xs font-bold ${msg.ok ? "text-grass" : "text-banner"}`}>{msg.text}</p>
      )}
    </div>
  );
}
