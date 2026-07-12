import "server-only";
import { createServerClient } from "@/lib/supabase/server";

// Panel de accesos: SOLO el líder. Se compara con LEADER_EMAIL (env, en Vercel).
// Si no está configurado, nadie tiene acceso (seguro por defecto).
export function isLeaderEmail(email: string | null | undefined): boolean {
  const leader = process.env.LEADER_EMAIL?.trim().toLowerCase();
  return !!leader && !!email && email.trim().toLowerCase() === leader;
}

const THROTTLE_MS = 15 * 60_000; // no registrar más de 1 acceso por usuario/15 min

// Registra un acceso (best-effort, con throttle). Nunca lanza.
export async function recordAccess(email: string | null | undefined): Promise<void> {
  if (!email) return;
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("app_access")
      .select("at")
      .eq("email", email)
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = data?.at ? new Date(data.at as string).getTime() : 0;
    if (Date.now() - last < THROTTLE_MS) return; // ya registrado hace poco
    await svc.from("app_access").insert({ email });
  } catch {
    /* best-effort: si falla (o no está migrado), no rompe la carga */
  }
}

export interface AccessRow {
  email: string | null;
  at: string;
}

// Últimos accesos (log crudo) y "último acceso" por usuario (resumen).
export async function getAccessData(limit = 200): Promise<{
  recent: AccessRow[];
  perUser: { email: string | null; at: string; count: number }[];
}> {
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("app_access")
      .select("email, at")
      .order("at", { ascending: false })
      .limit(limit);
    const recent = (data as AccessRow[]) ?? [];
    const map = new Map<string, { email: string | null; at: string; count: number }>();
    for (const r of recent) {
      const key = r.email ?? "—";
      const cur = map.get(key);
      if (!cur) map.set(key, { email: r.email, at: r.at, count: 1 });
      else cur.count++; // recent viene ordenado desc: el primero es el último acceso
    }
    const perUser = [...map.values()].sort((a, b) => (a.at < b.at ? 1 : -1));
    return { recent, perUser };
  } catch {
    return { recent: [], perUser: [] };
  }
}
