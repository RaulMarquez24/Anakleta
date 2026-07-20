"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { RULE_FIELDS } from "@/lib/rules";

const FIELD_BY_KEY = new Map(RULE_FIELDS.map((f) => [f.key, f]));

// Guarda los valores de las normas (settings). Solo claves de RULE_FIELDS, con
// clamp a sus límites. Cualquier colíder autenticado.
export async function saveRules(
  values: Record<string, number>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };

  const rows: { key: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(values)) {
    const f = FIELD_BY_KEY.get(key);
    if (!f) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    const clamped = Math.max(f.min, Math.min(f.max, Math.round(n)));
    rows.push({ key, value: String(clamped) });
  }
  if (rows.length === 0) return { ok: false, error: "Nada que guardar." };

  const svc = createServerClient();
  const { error } = await svc.from("settings").upsert(rows, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };

  // Afecta a cómo se clasifican ataques y a la actividad.
  revalidatePath("/normas");
  revalidatePath("/actividad");
  return { ok: true };
}
