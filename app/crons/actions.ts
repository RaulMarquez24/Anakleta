"use server";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { getCronHistory, type CronHistoryItem } from "@/lib/cron-log";

// Lanza un cron a mano. Sigue protegido por CRON_SECRET: la acción (con sesión
// de usuario) llama al endpoint desde el servidor con el secreto. Devuelve el
// JSON del endpoint para mostrarlo en el panel.
const BASE = process.env.APP_URL || "https://anakleta.vercel.app";

export type CronResult = { ok: boolean; error?: string; data?: unknown };

async function call(path: string): Promise<CronResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, error: "CRON_SECRET no configurado." };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function runSnapshotLight(): Promise<CronResult> {
  return call("/api/snapshot?mode=light");
}
export async function runSnapshotFull(): Promise<CronResult> {
  return call("/api/snapshot?mode=full");
}
export async function runThRoles(): Promise<CronResult> {
  return call("/api/th-roles");
}
export async function runCwlCron(): Promise<CronResult> {
  return call("/api/cwl-cron");
}
export async function runWarReminder(): Promise<CronResult> {
  return call("/api/war-reminder");
}

// Historial paginado de una tarea (10 por página).
export async function loadHistory(
  job: string,
  offset: number,
): Promise<{ items: CronHistoryItem[]; hasMore: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], hasMore: false };
  return getCronHistory(job, offset);
}
