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
