import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type WarnStatus = "vigente" | "caducado" | "resuelto";

export interface Warn {
  id: number;
  reason: string;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  status: WarnStatus;
}

const DEFAULT_THRESHOLD = 3;
const DEFAULT_EXPIRY_DAYS = 90;

// Config de warns desde `settings` (con defaults). expiryDays=0 => no caduca.
export async function getWarnConfig(): Promise<{ threshold: number; expiryDays: number }> {
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("settings")
      .select("key, value")
      .in("key", ["warns_threshold", "warns_expiry_days"]);
    const m = new Map((data ?? []).map((r) => [r.key as string, r.value as string | null]));
    const th = Number(m.get("warns_threshold"));
    const ex = Number(m.get("warns_expiry_days"));
    return {
      threshold: Number.isFinite(th) && th > 0 ? th : DEFAULT_THRESHOLD,
      expiryDays: Number.isFinite(ex) && ex >= 0 ? ex : DEFAULT_EXPIRY_DAYS,
    };
  } catch {
    return { threshold: DEFAULT_THRESHOLD, expiryDays: DEFAULT_EXPIRY_DAYS };
  }
}

function statusOf(active: boolean, createdAt: string, expiryDays: number): WarnStatus {
  if (!active) return "resuelto";
  if (expiryDays > 0) {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
    if (ageDays > expiryDays) return "caducado";
  }
  return "vigente";
}

// Warns de un miembro agrupados por estado efectivo (para la ficha).
export async function getMemberWarns(
  tag: string,
): Promise<{ vigentes: Warn[]; caducados: Warn[]; resueltos: Warn[] }> {
  const empty = { vigentes: [], caducados: [], resueltos: [] };
  try {
    const { expiryDays } = await getWarnConfig();
    const svc = createServerClient();
    const { data } = await svc
      .from("warns")
      .select("*")
      .eq("member_tag", tag)
      .order("created_at", { ascending: false })
      .limit(500);
    const out = { vigentes: [] as Warn[], caducados: [] as Warn[], resueltos: [] as Warn[] };
    for (const r of data ?? []) {
      const active = Boolean(r.active);
      const createdAt = r.created_at as string;
      const status = statusOf(active, createdAt, expiryDays);
      const w: Warn = {
        id: r.id as number,
        reason: (r.reason as string) ?? "",
        active,
        createdBy: (r.created_by as string | null) ?? null,
        createdAt,
        resolvedBy: (r.resolved_by as string | null) ?? null,
        resolvedAt: (r.resolved_at as string | null) ?? null,
        resolution: (r.resolution as string | null) ?? null,
        status,
      };
      if (status === "vigente") out.vigentes.push(w);
      else if (status === "caducado") out.caducados.push(w);
      else out.resueltos.push(w);
    }
    return out;
  } catch {
    return empty;
  }
}

// Nº de warns VIGENTES (activos y dentro de plazo) por tag. Para dashboard y actividad.
export async function getActiveWarnCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    const { expiryDays } = await getWarnConfig();
    const svc = createServerClient();
    const { data } = await svc
      .from("warns")
      .select("member_tag, created_at")
      .eq("active", true)
      .limit(50000);
    const cutoff = expiryDays > 0 ? Date.now() - expiryDays * 86_400_000 : -Infinity;
    for (const r of data ?? []) {
      const at = new Date(r.created_at as string).getTime();
      if (at < cutoff) continue; // caducado
      const tag = r.member_tag as string;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return counts;
  } catch {
    return counts;
  }
}
