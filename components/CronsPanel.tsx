"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  runSnapshotLight,
  runSnapshotFull,
  runThRoles,
  runCwlCron,
  runWarReminder,
  loadHistory,
  type CronResult,
} from "@/app/crons/actions";
import type { CronHistoryItem } from "@/lib/cron-log";

type Data = Record<string, unknown>;

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

// Quién lanzó la ejecución: automático (cron) o el colíder concreto.
function who(actor: string | null): string {
  if (!actor || actor === "cron") return "🤖 automático";
  return `👤 ${actor.split("@")[0]}`;
}

// Resumen de una línea del resultado devuelto al lanzar a mano.
function summarize(key: string, r: CronResult): string {
  if (!r.ok && r.error) return `✕ ${r.error}`;
  const d = (r.data ?? {}) as Data;
  if (d.error) return `✕ ${String(d.error)}`;
  if (d.cooldown) return `⏳ ${String(d.message ?? "espera un poco antes de repetir")}`;
  if (d.skip) return `· ${String(d.skip)}`;

  if (key === "snapshot") {
    const war = d.war && typeof d.war === "object" && !("error" in (d.war as Data)) ? (d.war as Data) : null;
    return `✓ ${d.members_captured ?? "—"} miembros · ${d.members_deactivated ?? 0} bajas${
      d.mode === "full" ? ` · ${d.members_enriched ?? 0} enriquecidos${war ? ` · guerra: ${war.recorded ?? 0}r` : ""}` : ""
    }`;
  }
  if (key === "th-roles") {
    const c = (d.counts ?? {}) as Record<string, number>;
    return `✓ ${c.updated ?? 0} actualizados · ${c.noChange ?? 0} sin cambio · ${c.notInGuild ?? 0} fuera${c.permFail ? ` · ${c.permFail} fallos` : ""}`;
  }
  if (key === "cwl-cron") {
    const a = (d.actions as string[] | undefined) ?? [];
    return a.length ? `✓ ${a.join(" · ")}` : "✓ sin cambios";
  }
  if (key === "war-reminder") {
    return `✓ aviso ≤${d.tier}h · ${d.pinged ?? 0} etiquetados`;
  }
  return r.ok ? "✓ hecho" : "✕ error";
}

// Historial paginado (10) con scroll de una tarea.
function TaskHistory({ job, reloadKey }: { job: string; reloadKey: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CronHistoryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load(reset: boolean) {
    setLoading(true);
    const off = reset ? 0 : offset;
    const r = await loadHistory(job, off);
    setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
    setOffset(off + r.items.length);
    setHasMore(r.hasMore);
    setLoading(false);
  }

  // Al ejecutarse la tarea (reloadKey cambia) recarga desde el principio si está abierto.
  useEffect(() => {
    if (reloadKey > 0 && open) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  function toggle() {
    if (!open) {
      setOpen(true);
      if (items.length === 0) void load(true);
    } else {
      setOpen(false);
    }
  }

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (hasMore && !loading && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) void load(false);
  }

  return (
    <div className="mt-2 border-t border-line pt-2">
      <button onClick={toggle} className="text-xs font-bold text-ink-soft underline">
        {open ? "Ocultar historial" : "🕘 Historial"}
      </button>
      {open && (
        <div
          onScroll={onScroll}
          className="mt-2 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-surface-2/40 p-2"
        >
          {items.length === 0 && !loading && (
            <p className="p-2 text-center text-xs text-ink-soft">Sin ejecuciones registradas.</p>
          )}
          {items.map((it) => (
            <div key={it.id} className="rounded-lg bg-surface p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{fmt(it.createdAt)}</span>
                <span className="flex items-center gap-2">
                  {!it.ok && <span className="font-bold text-banner">con fallos</span>}
                  <span className="text-[11px] font-bold text-ink-soft">{who(it.actor)}</span>
                </span>
              </div>
              <p className="mt-0.5 text-ink-soft">{it.summary}</p>
              {it.details.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-ink-soft">detalle ({it.details.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {it.details.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
          {loading && <p className="p-2 text-center text-xs text-ink-soft">Cargando…</p>}
          {hasMore && !loading && (
            <button onClick={() => void load(false)} className="w-full py-1 text-xs font-bold text-gold-deep">
              Cargar más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  job,
  icon,
  title,
  desc,
  result,
  reloadKey,
  children,
}: {
  job: string;
  icon: string;
  title: string;
  desc: string;
  result: string | null;
  reloadKey: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-2 text-lg">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-ink">{title}</p>
          <p className="text-xs text-ink-soft">{desc}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
      {result && (
        <p className={`mt-2 text-sm font-semibold ${result.startsWith("✕") ? "text-banner" : "text-ink"}`}>{result}</p>
      )}
      <TaskHistory job={job} reloadKey={reloadKey} />
    </div>
  );
}

export function CronsPanel() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [reload, setReload] = useState<Record<string, number>>({});

  function run(key: string, tag: string, fn: () => Promise<CronResult>) {
    setBusy(tag);
    start(async () => {
      const r = await fn();
      setResults((prev) => ({ ...prev, [key]: summarize(key, r) }));
      setReload((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 })); // refresca su historial
      setBusy(null);
      router.refresh();
    });
  }

  const solid =
    "flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50";
  const ghost =
    "flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 py-2.5 text-sm font-extrabold text-ink transition hover:bg-line disabled:opacity-50";

  return (
    <div className="space-y-3">
      <TaskCard
        job="snapshot"
        icon="🔄"
        title="Sincronizar con Clash"
        desc="Rápido: miembros, bajas y donaciones. Completo: además guerra, estrellas y capital."
        result={results["snapshot"] ?? null}
        reloadKey={reload["snapshot"] ?? 0}
      >
        <button onClick={() => run("snapshot", "light", runSnapshotLight)} disabled={pending} className={ghost}>
          {busy === "light" ? "Actualizando…" : "⚡ Refresco rápido"}
        </button>
        <button onClick={() => run("snapshot", "full", runSnapshotFull)} disabled={pending} className={solid}>
          {busy === "full" ? "Capturando…" : "🧩 Captura completa"}
        </button>
      </TaskCard>

      <TaskCard
        job="th-roles"
        icon="🏰"
        title="Roles de TH"
        desc="Pone a cada miembro vinculado el rol de su ayuntamiento (cuenta principal)."
        result={results["th-roles"] ?? null}
        reloadKey={reload["th-roles"] ?? 0}
      >
        <button onClick={() => run("th-roles", "th", runThRoles)} disabled={pending} className={solid}>
          {busy === "th" ? "Sincronizando…" : "Ejecutar"}
        </button>
      </TaskCard>

      <TaskCard
        job="cwl-cron"
        icon="🏆"
        title="CWL (inscripciones)"
        desc="Crea la lista si toca, avisa y cierra/limpia según fechas."
        result={results["cwl-cron"] ?? null}
        reloadKey={reload["cwl-cron"] ?? 0}
      >
        <button onClick={() => run("cwl-cron", "cwl", runCwlCron)} disabled={pending} className={solid}>
          {busy === "cwl" ? "Ejecutando…" : "Ejecutar"}
        </button>
      </TaskCard>

      <TaskCard
        job="war-reminder"
        icon="⚔️"
        title="Aviso de guerra"
        desc="Si hay guerra en curso y gente sin atacar, avisa en Discord (según el tramo)."
        result={results["war-reminder"] ?? null}
        reloadKey={reload["war-reminder"] ?? 0}
      >
        <button onClick={() => run("war-reminder", "war", runWarReminder)} disabled={pending} className={solid}>
          {busy === "war" ? "Comprobando…" : "Ejecutar"}
        </button>
      </TaskCard>
    </div>
  );
}
