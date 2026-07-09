"use server";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";

// Guarda (o borra) el comentario manual de un miembro/ex-miembro. La UI refleja
// el cambio al instante con estado local; la lista cacheada se refresca sola
// (getDepartures, revalidate 300s).
export async function setMemberNote(tag: string, note: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const clean = note.trim().slice(0, 300);
  const svc = createServerClient();
  const { error } = await svc
    .from("members")
    .update({ note: clean || null })
    .eq("tag", tag);
  if (error) return { ok: false };

  return { ok: true };
}
