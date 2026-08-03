"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";

// Guarda (o borra) el comentario manual de un miembro/ex-miembro, con autor y
// fecha. La UI refleja el cambio al instante con estado local.
export interface NoteResult {
  ok: boolean;
  by?: string | null;
  at?: string | null;
}

export async function setMemberNote(tag: string, note: string): Promise<NoteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const clean = note.trim().slice(0, 300);
  const by = clean ? (user.email ?? null) : null;
  const at = clean ? new Date().toISOString() : null;
  const svc = createServerClient();

  // Intento con autor+fecha; si esas columnas aún no están migradas, guardo al
  // menos la nota para no perder la funcionalidad.
  let { error } = await svc
    .from("members")
    .update({ note: clean || null, note_by: by, note_at: at })
    .eq("tag", tag);
  if (error) {
    ({ error } = await svc.from("members").update({ note: clean || null }).eq("tag", tag));
  }
  if (error) return { ok: false };

  return { ok: true, by, at };
}

// Marca `secondaryTag` como cuenta secundaria de `primaryTag` (misma persona).
// Aplana el grupo: si el elegido ya es secundario, usa su raíz; y las secundarias
// que colgaban de secondaryTag se re-cuelgan de la raíz.
export async function linkAccounts(
  secondaryTag: string,
  primaryTag: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  if (!secondaryTag || !primaryTag || secondaryTag === primaryTag) return { ok: false };

  const svc = createServerClient();
  const { data: prim } = await svc
    .from("members")
    .select("main_tag")
    .eq("tag", primaryTag)
    .maybeSingle();
  let root = ((prim?.main_tag as string | null) ?? null) || primaryTag;
  if (root === secondaryTag) root = primaryTag; // evita ciclo directo

  const { error } = await svc.from("members").update({ main_tag: root }).eq("tag", secondaryTag);
  if (error) return { ok: false };
  // Re-colgar las que apuntaban a la secundaria bajo la nueva raíz, y asegurar
  // que la raíz no queda como secundaria de nadie.
  await svc.from("members").update({ main_tag: root }).eq("main_tag", secondaryTag);
  await svc.from("members").update({ main_tag: null }).eq("tag", root);
  return { ok: true };
}

export async function unlinkAccount(tag: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const svc = createServerClient();
  const { error } = await svc.from("members").update({ main_tag: null }).eq("tag", tag);
  return { ok: !error };
}

// Vincula (o desvincula) la cuenta de Discord de un miembro, para poder
// etiquetarlo en los avisos. discordId vacío = desvincular.
export async function setMemberDiscord(
  tag: string,
  discordId: string,
  discordUsername: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const svc = createServerClient();
  const id = discordId.trim() || null;
  const { error } = await svc
    .from("members")
    .update({
      discord_id: id,
      discord_username: id ? discordUsername.trim() || null : null,
      discord_by: id ? (user.email ?? null) : null,
      discord_at: id ? new Date().toISOString() : null,
    })
    .eq("tag", tag);
  return { ok: !error };
}

// Marca como revisada la vuelta de un miembro (quita el aviso de "ha vuelto").
export async function markReturnReviewed(tag: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const svc = createServerClient();
  const { error } = await svc.from("members").update({ return_reviewed: true }).eq("tag", tag);
  return { ok: !error };
}

// --- Warns (amonestaciones por incumplir normas) ---

export interface NewWarn {
  id: number;
  reason: string;
  createdBy: string | null;
  createdAt: string;
}

// Amonesta a un miembro. Cualquier colíder; queda registrado quién y cuándo.
export async function addWarn(tag: string, reason: string): Promise<{ ok: boolean; warn?: NewWarn }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const clean = reason.trim().slice(0, 300);
  if (!tag || !clean) return { ok: false };

  const svc = createServerClient();
  const { data, error } = await svc
    .from("warns")
    .insert({ member_tag: tag, reason: clean, created_by: user.email ?? null })
    .select("id, reason, created_by, created_at")
    .single();
  if (error || !data) return { ok: false };
  return {
    ok: true,
    warn: {
      id: data.id as number,
      reason: data.reason as string,
      createdBy: (data.created_by as string | null) ?? null,
      createdAt: data.created_at as string,
    },
  };
}

// Resuelve un warn (deja de contar) guardando quién y el desenlace. No borra.
// Compensa una propuesta de EXPULSIÓN (venga de warns, inactividad, guerras sin
// atacar, días en rojo…) aplicando otra sanción. Funciona como PUNTO Y APARTE:
// su fecha es el corte y lo anterior deja de contar para siempre; el miembro
// vuelve a acumular desde cero. NO se borra nada: todo queda en el historial.
export async function compensateExpulsion(input: {
  tag: string;
  sanction: string;
  // Qué se perdona: "all" (todo), "warns" (solo los warns) u "others" (todo
  // menos los warns: guerras, inactividad, días en rojo, donaciones…).
  scope?: "all" | "warns" | "others";
  note?: string;
  reasons?: string[];
  appliedTo?: { tag?: string | null; name?: string | null };
}): Promise<{ ok: boolean; error?: string; warnsResolved?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const sanction = input.sanction.trim().slice(0, 200);
  if (!sanction) return { ok: false, error: "Indica qué sanción se aplicó." };

  const svc = createServerClient();
  const onOther = input.appliedTo?.tag && input.appliedTo.tag !== input.tag;
  const scope = input.scope ?? "all";

  const { error } = await svc.from("member_sanctions").insert({
    member_tag: input.tag,
    sanction,
    scope,
    applied_to_tag: onOther ? input.appliedTo?.tag : null,
    applied_to_name: onOther ? (input.appliedTo?.name ?? null) : null,
    reasons: (input.reasons ?? []).join(" · ").slice(0, 500) || null,
    note: input.note?.trim().slice(0, 300) || null,
    created_by: user.email ?? null,
    expires_at: null, // el perdón de lo anterior no caduca
  });
  if (error) return { ok: false, error: error.message };

  // Los warns solo se saldan si entran en el alcance elegido.
  let warnsResolved = 0;
  if (scope === "all" || scope === "warns") {
    const r = await compensateWarns(input.tag, sanction, input.appliedTo);
    warnsResolved = r.resolved ?? 0;
  }
  revalidatePath("/actividad");
  return { ok: true, warnsResolved };
}

// Revoca una compensación: el miembro vuelve a evaluarse con normalidad.
export async function revokeSanction(id: number): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { error } = await svc.from("member_sanctions").update({ revoked: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/actividad");
  return { ok: true };
}

// Compensa (salda) TODOS los warns vigentes de un miembro: en vez de expulsar se
// aplica otra sanción (degradar, excluir de una guerra…) y los warns quedan
// resueltos con constancia de qué se hizo. `appliedToTag`/`appliedToName`: si la
// medida se aplicó sobre otra cuenta del mismo jugador (p. ej. su principal).
export async function compensateWarns(
  tag: string,
  sanction: string,
  appliedTo?: { tag?: string | null; name?: string | null },
): Promise<{ ok: boolean; resolved?: number; resolution?: string; by?: string | null; at?: string | null; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const s = sanction.trim().slice(0, 200);
  if (!s) return { ok: false, error: "Indica qué sanción se aplicó." };

  const by = user.email ?? null;
  const at = new Date().toISOString();
  const onOther = appliedTo?.tag && appliedTo.tag !== tag;
  const resolution = `Compensado: ${s}${onOther ? ` (aplicado a ${appliedTo?.name ?? appliedTo?.tag})` : ""}`.slice(0, 300);

  const svc = createServerClient();
  const { data, error } = await svc
    .from("warns")
    .update({ active: false, resolved_by: by, resolved_at: at, resolution })
    .eq("member_tag", tag)
    .eq("active", true)
    .select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, resolved: (data ?? []).length, resolution, by, at };
}

// Resuelve VARIOS warns a la vez con el mismo desenlace.
export async function resolveWarns(
  ids: number[],
  resolution: string,
): Promise<{ ok: boolean; by?: string | null; at?: string | null; resolved?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const list = ids.filter((n) => Number.isFinite(n)).slice(0, 100);
  if (list.length === 0) return { ok: false };
  const by = user.email ?? null;
  const at = new Date().toISOString();
  const svc = createServerClient();
  const { data, error } = await svc
    .from("warns")
    .update({
      active: false,
      resolved_by: by,
      resolved_at: at,
      resolution: resolution.trim().slice(0, 300) || null,
    })
    .in("id", list)
    .select("id");
  if (error) return { ok: false };
  return { ok: true, by, at, resolved: (data ?? []).length };
}

export async function resolveWarn(
  id: number,
  resolution: string,
): Promise<{ ok: boolean; by?: string | null; at?: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const by = user.email ?? null;
  const at = new Date().toISOString();
  const svc = createServerClient();
  const { error } = await svc
    .from("warns")
    .update({ active: false, resolved_by: by, resolved_at: at, resolution: resolution.trim().slice(0, 300) || null })
    .eq("id", id);
  if (error) return { ok: false };
  return { ok: true, by, at };
}
