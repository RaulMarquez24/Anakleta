import "server-only";
import { createServerClient } from "@/lib/supabase/server";

// Guarda el resultado de una ejecución de cron en cron_runs (traza). Nunca lanza:
// si el registro falla, no debe tumbar la tarea.
export async function logCronRun(job: string, ok: boolean, summary: unknown): Promise<void> {
  try {
    const svc = createServerClient();
    await svc.from("cron_runs").insert({ job, ok, summary });
  } catch (err) {
    console.error("[cron-log]", err);
  }
}

export interface CronRun {
  id: number;
  job: string;
  ok: boolean;
  summary: unknown;
  created_at: string;
}

// --- Resumen legible por tipo de tarea (reutilizado en el historial) ---

export function summarizeRun(run: CronRun): string {
  const s = (run.summary ?? {}) as Record<string, unknown>;
  if (run.job === "snapshot") {
    return `${s.members_captured ?? "—"} miembros · ${s.members_deactivated ?? 0} bajas${s.mode === "full" ? " · completa" : ""}`;
  }
  if (run.job === "th-roles") {
    const c = (s.counts ?? {}) as Record<string, number>;
    return `${c.updated ?? 0} actualizados · ${c.noChange ?? 0} sin cambio · ${c.notInGuild ?? 0} fuera${c.permFail ? ` · ${c.permFail} fallos` : ""}`;
  }
  if (run.job === "cwl-cron") {
    const a = (s.actions as string[] | undefined) ?? [];
    return a.length ? a.join(" · ") : "sin cambios";
  }
  if (run.job === "war-reminder") {
    return `aviso ≤${s.tier}h · ${s.pinged ?? 0} etiquetados${s.unlinked ? ` · ${s.unlinked} sin Discord` : ""}`;
  }
  return "";
}

export function runDetails(run: CronRun): string[] {
  const s = (run.summary ?? {}) as Record<string, unknown>;
  if (run.job === "th-roles") return (s.updated as string[] | undefined) ?? [];
  return [];
}

export interface CronHistoryItem {
  id: number;
  ok: boolean;
  createdAt: string;
  summary: string;
  details: string[];
}

// Historial de UNA tarea, paginado (10 por página).
export async function getCronHistory(
  job: string,
  offset: number,
  limit = 10,
): Promise<{ items: CronHistoryItem[]; hasMore: boolean }> {
  const svc = createServerClient();
  const { data } = await svc
    .from("cron_runs")
    .select("id, job, ok, summary, created_at")
    .eq("job", job)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit); // pide limit+1 para saber si hay más
  const rows = (data as CronRun[]) ?? [];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((r) => ({
    id: r.id,
    ok: r.ok,
    createdAt: r.created_at,
    summary: summarizeRun(r),
    details: runDetails(r),
  }));
  return { items, hasMore };
}
