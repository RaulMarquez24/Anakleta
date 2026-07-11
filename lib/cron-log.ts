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

// Últimas ejecuciones (para la pantalla de registro).
export async function getCronRuns(limit = 50): Promise<CronRun[]> {
  const svc = createServerClient();
  const { data } = await svc
    .from("cron_runs")
    .select("id, job, ok, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as CronRun[]) ?? [];
}
