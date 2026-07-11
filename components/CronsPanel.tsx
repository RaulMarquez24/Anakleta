"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  runSnapshotLight,
  runSnapshotFull,
  runThRoles,
  runCwlCron,
  runWarReminder,
  type CronResult,
} from "@/app/crons/actions";

type Data = Record<string, unknown>;

// Resumen de una línea del resultado devuelto por cada endpoint.
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

function TaskCard({
  icon,
  title,
  desc,
  children,
  result,
}: {
  icon: string;
  title: string;
  desc: string;
  children: React.ReactNode;
  result: string | null;
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
    </div>
  );
}

export function CronsPanel() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  function run(key: string, tag: string, fn: () => Promise<CronResult>) {
    setBusy(tag);
    start(async () => {
      const r = await fn();
      setResults((prev) => ({ ...prev, [key]: summarize(key, r) }));
      setBusy(null);
      router.refresh(); // actualiza el registro de abajo
    });
  }

  const btn = (label: string, tag: string, gold = false) =>
    `flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-extrabold transition disabled:opacity-50 ${
      gold ? "bg-gold text-banner-dark hover:brightness-105" : "border border-line bg-surface-2 text-ink hover:bg-line"
    }`;

  return (
    <div className="space-y-3">
      <TaskCard
        icon="🔄"
        title="Sincronizar con Clash"
        desc="Rápido: miembros, bajas y donaciones. Completo: además guerra, estrellas y capital."
        result={results["snapshot"] ?? null}
      >
        <button
          onClick={() => run("snapshot", "light", runSnapshotLight)}
          disabled={pending}
          className={btn("", "light")}
        >
          {busy === "light" ? "Actualizando…" : "⚡ Refresco rápido"}
        </button>
        <button
          onClick={() => run("snapshot", "full", runSnapshotFull)}
          disabled={pending}
          className={btn("", "full", true)}
        >
          {busy === "full" ? "Capturando…" : "🧩 Captura completa"}
        </button>
      </TaskCard>

      <TaskCard icon="🏰" title="Roles de TH" desc="Pone a cada miembro vinculado el rol de su ayuntamiento (cuenta principal)." result={results["th-roles"] ?? null}>
        <button onClick={() => run("th-roles", "th", runThRoles)} disabled={pending} className={btn("", "th", true)}>
          {busy === "th" ? "Sincronizando…" : "Ejecutar"}
        </button>
      </TaskCard>

      <TaskCard icon="🏆" title="CWL (inscripciones)" desc="Crea la lista si toca, avisa y cierra/limpia según fechas." result={results["cwl-cron"] ?? null}>
        <button onClick={() => run("cwl-cron", "cwl", runCwlCron)} disabled={pending} className={btn("", "cwl", true)}>
          {busy === "cwl" ? "Ejecutando…" : "Ejecutar"}
        </button>
      </TaskCard>

      <TaskCard icon="⚔️" title="Aviso de guerra" desc="Si hay guerra en curso y gente sin atacar, avisa en Discord (según el tramo)." result={results["war-reminder"] ?? null}>
        <button onClick={() => run("war-reminder", "war", runWarReminder)} disabled={pending} className={btn("", "war", true)}>
          {busy === "war" ? "Comprobando…" : "Ejecutar"}
        </button>
      </TaskCard>
    </div>
  );
}
