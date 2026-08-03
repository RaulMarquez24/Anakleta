import { createServerClient } from "@/lib/supabase/server";

// Sanción aplicada para COMPENSAR una propuesta de expulsión (venga de warns,
// inactividad, guerras sin atacar, días en rojo…). Funciona como BORRÓN Y CUENTA
// NUEVA: su fecha es un punto de corte y todo lo anterior queda perdonado para
// siempre; a partir de ahí el miembro vuelve a acumular desde cero.
export interface Sanction {
  id: number;
  memberTag: string;
  sanction: string;
  appliedToTag: string | null;
  appliedToName: string | null;
  reasons: string | null; // motivos que había cuando se compensó
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null; // en desuso: la amnistía no caduca
  revoked: boolean;
  active: boolean; // no revocada (el perdón de lo anterior es permanente)
  cutMs: number; // punto de corte en ms: lo anterior no cuenta
}

function toSanction(r: Record<string, unknown>): Sanction {
  const expiresAt = (r.expires_at as string | null) ?? null;
  const revoked = Boolean(r.revoked);
  const vigente = !revoked;
  return {
    cutMs: Date.parse(r.created_at as string),
    id: r.id as number,
    memberTag: r.member_tag as string,
    sanction: (r.sanction as string) ?? "",
    appliedToTag: (r.applied_to_tag as string | null) ?? null,
    appliedToName: (r.applied_to_name as string | null) ?? null,
    reasons: (r.reasons as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
    expiresAt,
    revoked,
    active: vigente,
  };
}

// Sanciones VIGENTES por miembro (para la evaluación de actividad). Devuelve la
// más reciente de cada uno. Resiliente: si la tabla aún no existe, mapa vacío.
export async function getActiveSanctions(): Promise<Map<string, Sanction>> {
  const out = new Map<string, Sanction>();
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("member_sanctions")
      .select("*")
      .eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(2000);
    for (const r of data ?? []) {
      const s = toSanction(r as Record<string, unknown>);
      if (!s.active) continue;
      if (!out.has(s.memberTag)) out.set(s.memberTag, s); // la más reciente
    }
  } catch {
    /* tabla sin migrar todavía */
  }
  return out;
}

// Historial de sanciones de un miembro (vigentes y pasadas).
export async function getMemberSanctions(tag: string): Promise<Sanction[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("member_sanctions")
      .select("*")
      .eq("member_tag", tag)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((r) => toSanction(r as Record<string, unknown>));
  } catch {
    return [];
  }
}
