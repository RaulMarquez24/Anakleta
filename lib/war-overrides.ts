import "server-only";
import { createServerClient } from "@/lib/supabase/server";

// Correcciones manuales del 2º ataque para una guerra (war_key = startTime).
// Devuelve { tag: should } (true = sí puede ayudar, false = no hace falta).
export async function getWarHelpOverrides(warKey: string): Promise<Record<string, boolean>> {
  if (!warKey) return {};
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("war_help_overrides")
      .select("tag, should")
      .eq("war_key", warKey);
    const out: Record<string, boolean> = {};
    for (const r of data ?? []) out[r.tag as string] = Boolean(r.should);
    return out;
  } catch {
    return {};
  }
}
