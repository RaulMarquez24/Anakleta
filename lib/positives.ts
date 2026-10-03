import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { getRulesConfig } from "@/lib/rules";

// Positivos (méritos): lo contrario de un warn. Un colíder anota algo que alguien
// hizo bien y eso suma puntos de participación para los ascensos. Nunca resta.
export interface Positive {
  id: number;
  reason: string;
  points: number;
  createdBy: string | null;
  createdAt: string;
  vigente: boolean; // dentro del plazo en el que cuenta
}

function vigenteDesde(days: number): number {
  return days > 0 ? Date.now() - days * 86_400_000 : -Infinity;
}

function toPositive(r: Record<string, unknown>, cutoff: number): Positive {
  const createdAt = r.created_at as string;
  return {
    id: r.id as number,
    reason: (r.reason as string) ?? "",
    points: (r.points as number | null) ?? 0,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt,
    vigente: new Date(createdAt).getTime() >= cutoff,
  };
}

// Positivos de un miembro (para su ficha), los recientes primero.
export async function getMemberPositives(tag: string): Promise<Positive[]> {
  try {
    const rules = await getRulesConfig();
    const cutoff = vigenteDesde(rules.positivesDays);
    const svc = createServerClient();
    const { data } = await svc
      .from("positives")
      .select("*")
      .eq("member_tag", tag)
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((r) => toPositive(r as Record<string, unknown>, cutoff));
  } catch {
    return []; // tabla sin migrar
  }
}

// Puntos y nº de positivos VIGENTES por tag (para actividad y ascensos).
export async function getPositiveTotals(): Promise<Map<string, { points: number; count: number }>> {
  const out = new Map<string, { points: number; count: number }>();
  try {
    const rules = await getRulesConfig();
    const cutoff = vigenteDesde(rules.positivesDays);
    const svc = createServerClient();
    const { data } = await svc
      .from("positives")
      .select("member_tag, points, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    for (const r of data ?? []) {
      if (new Date(r.created_at as string).getTime() < cutoff) continue;
      const tag = r.member_tag as string;
      const prev = out.get(tag) ?? { points: 0, count: 0 };
      out.set(tag, {
        points: prev.points + ((r.points as number | null) ?? 0),
        count: prev.count + 1,
      });
    }
  } catch {
    /* tabla sin migrar */
  }
  return out;
}
