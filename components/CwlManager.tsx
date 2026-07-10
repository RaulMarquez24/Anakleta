"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createList,
  setState as setListState,
  setSize,
  setDates,
  addSignupMember,
  addSignupDiscord,
  removeSignup,
} from "@/app/liga/inscripciones/actions";

export interface CwlEntryView {
  id: number;
  name: string;
  townHall: number | null;
  discordId: string | null;
  source: string;
  addedBy: string | null;
}
export interface ClanMemberOpt {
  tag: string;
  name: string;
  townHall: number | null;
  discordId: string | null;
}
export interface DiscordMemberOpt {
  id: string;
  label: string;
  username: string;
}

export interface CwlManagerProps {
  season: string; // temporada de esta liga (la página)
  exists: boolean; // ¿hay ya inscripción (cwl_lists) para esta liga?
  state: "open" | "closed" | null;
  size: number | null;
  cutoff: number | null;
  closeDate: string | null; // starts_at ISO
  opensAt: string | null;
  endsAt: string | null;
  inside: CwlEntryView[];
  queue: CwlEntryView[];
  hiddenNames: string[];
  clanMembers: ClanMemberOpt[];
  discordMembers: DiscordMemberOpt[];
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function CwlManager(props: CwlManagerProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Algo salió mal.");
      else router.refresh();
    });
  }

  const season = props.season;

  // ---- Sin inscripción todavía para esta liga ----
  if (!props.exists || props.state === null) {
    return <CreateCard season={season} pending={pending} err={err} onCreate={(sz, st) => run(() => createList(season, sz, st))} />;
  }

  const isOpen = props.state === "open";
  const total = props.inside.length + props.queue.length;

  return (
    <div className="space-y-4">
      {err && <p className="rounded-lg bg-banner/10 px-3 py-2 text-sm font-semibold text-banner">{err}</p>}

      {/* Cabecera + controles */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink">Inscripción</p>
            <p className="text-xs text-ink-soft">
              {props.inside.length}/{props.cutoff} dentro
              {props.queue.length > 0 && ` · ${props.queue.length} en cola`}
            </p>
          </div>
          <span
            className={`flex-none rounded-full px-2.5 py-1 text-xs font-extrabold ${
              isOpen ? "bg-grass/15 text-grass" : "bg-banner/15 text-banner"
            }`}
          >
            {isOpen ? "🟢 Abierta" : "🔒 Cerrada"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => run(() => setListState(season, isOpen ? "closed" : "open"))}
            disabled={pending}
            className="rounded-full bg-surface-2 px-3.5 py-1.5 text-sm font-extrabold text-ink transition hover:bg-line disabled:opacity-50"
          >
            {isOpen ? "🔒 Cerrar inscripción" : "🟢 Reabrir inscripción"}
          </button>
        </div>

        {/* Corte */}
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">Límite de plazas</p>
          <div className="flex gap-2">
            {[
              { label: "Auto (15→30)", val: null as number | null },
              { label: "15 fijo", val: 15 },
              { label: "30 fijo", val: 30 },
            ].map((o) => {
              const active = props.size === o.val;
              return (
                <button
                  key={o.label}
                  onClick={() => run(() => setSize(season, o.val))}
                  disabled={pending}
                  className={`flex-1 rounded-full px-2 py-1.5 text-xs font-extrabold transition disabled:opacity-50 ${
                    active ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fechas (avanzado) */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-ink-soft">
            Fechas (opcional)
          </summary>
          <DatesEditor
            opensAt={props.opensAt}
            startsAt={props.closeDate}
            endsAt={props.endsAt}
            pending={pending}
            onSave={(d) => run(() => setDates(season, d))}
          />
        </details>
      </div>

      {/* Añadir (colíder) */}
      <AddPanel
        clanMembers={props.clanMembers}
        discordMembers={props.discordMembers}
        pending={pending}
        onAddMember={(tag) => run(() => addSignupMember(season, tag))}
        onAddDiscord={(id, username) => run(() => addSignupDiscord(season, id, username))}
      />

      {/* Dentro */}
      <Section title={`✅ Dentro (${props.inside.length})`}>
        {props.inside.length === 0 ? (
          <Empty>Nadie apuntado todavía.</Empty>
        ) : (
          props.inside.map((e, i) => (
            <EntryRow key={e.id} i={i + 1} e={e} pending={pending} onRemove={() => run(() => removeSignup(season, e.id))} />
          ))
        )}
      </Section>

      {/* Cola */}
      {props.queue.length > 0 && (
        <Section title={`⏳ En cola (${props.queue.length})`} hint="Entran si se libera una plaza.">
          {props.queue.map((e, i) => (
            <EntryRow key={e.id} i={i + 1} e={e} queued pending={pending} onRemove={() => run(() => removeSignup(season, e.id))} />
          ))}
        </Section>
      )}

      {/* Ocultos (ex-clan) */}
      {props.hiddenNames.length > 0 && (
        <details className="rounded-2xl border border-dashed border-line bg-surface/60 p-3 text-sm">
          <summary className="cursor-pointer font-bold text-ink-soft">
            {props.hiddenNames.length} apuntado(s) fuera del clan (ocultos)
          </summary>
          <p className="mt-2 text-xs text-ink-soft">
            Siguen apuntados pero no cuentan ni se muestran mientras no estén en el clan: {props.hiddenNames.join(", ")}.
          </p>
        </details>
      )}

      {total === 0 && (
        <p className="text-center text-xs text-ink-soft">
          En el canal de inscripciones, escribiendo «me apunto» se apuntan solos.
        </p>
      )}
    </div>
  );
}

function EntryRow({
  i,
  e,
  queued,
  pending,
  onRemove,
}: {
  i: number;
  e: CwlEntryView;
  queued?: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
      <span className={`w-6 flex-none text-right text-sm font-extrabold tabular-nums ${queued ? "text-ink-soft" : "text-gold-deep"}`}>
        {i}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-ink">{e.name}</p>
        <p className="text-[11px] text-ink-soft">
          {e.townHall ? `TH${e.townHall}` : "sin TH"}
          {!e.discordId && " · 🎮 sin Discord"}
          {e.source === "app" && " · añadido a mano"}
        </p>
      </div>
      <button
        onClick={onRemove}
        disabled={pending}
        aria-label="Quitar"
        className="flex-none rounded-full px-2 py-1 text-sm font-extrabold text-ink-soft transition hover:bg-banner/10 hover:text-banner disabled:opacity-50"
      >
        ✕
      </button>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-3.5 py-2">
        <p className="text-sm font-extrabold text-ink">{title}</p>
        {hint && <p className="text-[11px] text-ink-soft">{hint}</p>}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3.5 py-4 text-center text-sm text-ink-soft">{children}</p>;
}

function AddPanel({
  clanMembers,
  discordMembers,
  pending,
  onAddMember,
  onAddDiscord,
}: {
  clanMembers: ClanMemberOpt[];
  discordMembers: DiscordMemberOpt[];
  pending: boolean;
  onAddMember: (tag: string) => void;
  onAddDiscord: (id: string, username: string) => void;
}) {
  const [mode, setMode] = useState<"clan" | "discord">("clan");
  const [tag, setTag] = useState(clanMembers[0]?.tag ?? "");
  const [did, setDid] = useState(discordMembers[0]?.id ?? "");

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">Añadir a mano</p>
      <div className="mb-2 flex gap-2">
        <button
          onClick={() => setMode("clan")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${mode === "clan" ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft"}`}
        >
          Del clan
        </button>
        <button
          onClick={() => setMode("discord")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${mode === "discord" ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft"}`}
        >
          De Discord
        </button>
      </div>
      {mode === "clan" ? (
        <div className="flex gap-2">
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            {clanMembers.map((m) => (
              <option key={m.tag} value={m.tag}>
                {m.name}
                {m.townHall ? ` (TH${m.townHall})` : ""}
                {m.discordId ? "" : " — sin Discord"}
              </option>
            ))}
          </select>
          <button
            onClick={() => tag && onAddMember(tag)}
            disabled={pending || !tag}
            className="flex-none rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={did}
            onChange={(e) => setDid(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            {discordMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const m = discordMembers.find((x) => x.id === did);
              if (m) onAddDiscord(m.id, m.username);
            }}
            disabled={pending || !did}
            className="flex-none rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
      )}
    </div>
  );
}

function CreateCard({
  season,
  pending,
  err,
  onCreate,
}: {
  season: string;
  pending: boolean;
  err: string | null;
  onCreate: (size: number | null, startsAt: string | null) => void;
}) {
  const [size, setSize] = useState<number | null>(null);
  const [start, setStart] = useState("");

  return (
    <div className="space-y-4">
      {err && <p className="rounded-lg bg-banner/10 px-3 py-2 text-sm font-semibold text-banner">{err}</p>}
      <div className="rounded-2xl border border-dashed border-line bg-surface/60 p-5 text-center">
        <p className="text-3xl">📋</p>
        <p className="mt-2 font-extrabold text-ink">Esta liga aún no tiene inscripción</p>
        <p className="mt-1 text-sm text-ink-soft">
          Normalmente la abre el cron ~1 semana antes. Puedes abrirla ya a mano:
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">Límite</span>
          <div className="flex gap-2">
            {[
              { label: "Auto (15→30)", val: null as number | null },
              { label: "15", val: 15 },
              { label: "30", val: 30 },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => setSize(o.val)}
                className={`flex-1 rounded-full px-2 py-1.5 text-xs font-extrabold transition ${size === o.val ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
            Inicio de la liga (cierra la inscripción individual) — opcional
          </span>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-gold"
          />
        </label>
        <button
          onClick={() => onCreate(size, start ? new Date(start).toISOString() : null)}
          disabled={pending}
          className="w-full rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {pending ? "Abriendo…" : `Abrir inscripción de ${season}`}
        </button>
      </div>
    </div>
  );
}

function DatesEditor({
  opensAt,
  startsAt,
  endsAt,
  pending,
  onSave,
}: {
  opensAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  pending: boolean;
  onSave: (d: { opens_at: string | null; starts_at: string | null; ends_at: string | null }) => void;
}) {
  const [o, setO] = useState(toLocalInput(opensAt));
  const [s, setS] = useState(toLocalInput(startsAt));
  const [e, setE] = useState(toLocalInput(endsAt));
  const iso = (v: string) => (v ? new Date(v).toISOString() : null);

  return (
    <div className="mt-2 space-y-2">
      {[
        { label: "Apertura", v: o, set: setO },
        { label: "Inicio liga (cierre)", v: s, set: setS },
        { label: "Fin liga (retira rol)", v: e, set: setE },
      ].map((f) => (
        <label key={f.label} className="flex items-center gap-2 text-xs">
          <span className="w-32 flex-none font-semibold text-ink-soft">{f.label}</span>
          <input
            type="datetime-local"
            value={f.v}
            onChange={(ev) => f.set(ev.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-ink outline-none focus:border-gold"
          />
        </label>
      ))}
      <button
        onClick={() => onSave({ opens_at: iso(o), starts_at: iso(s), ends_at: iso(e) })}
        disabled={pending}
        className="rounded-full bg-surface-2 px-3.5 py-1.5 text-xs font-extrabold text-ink transition hover:bg-line disabled:opacity-50"
      >
        Guardar fechas
      </button>
    </div>
  );
}
