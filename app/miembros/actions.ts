"use server";

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
