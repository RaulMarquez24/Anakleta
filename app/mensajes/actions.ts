"use server";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { MAX_LEN, type ClanMessage } from "./shared";

export async function addMessage(
  text: string,
  category?: string,
): Promise<{ ok: boolean; message?: ClanMessage }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  if (!clean) return { ok: false };
  const cat = (category ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || "General";

  const svc = createServerClient();
  const base = { text: clean, created_by: user.email ?? null };

  // Intento con categoría; si la columna aún no existe (migración pendiente),
  // reintento sin ella para no romper el guardado.
  let data: Record<string, unknown> | null = null;
  const first = await svc
    .from("messages")
    .insert({ ...base, category: cat })
    .select("id, text, category, created_by, created_at")
    .single();
  if (first.error) {
    const retry = await svc
      .from("messages")
      .insert(base)
      .select("id, text, created_by, created_at")
      .single();
    if (retry.error || !retry.data) return { ok: false };
    data = retry.data as Record<string, unknown>;
  } else {
    data = first.data as Record<string, unknown>;
  }

  return {
    ok: true,
    message: {
      id: data.id as number,
      text: data.text as string,
      category: (data.category as string | null) ?? cat,
      createdBy: (data.created_by as string | null) ?? null,
      createdAt: (data.created_at as string | null) ?? null,
    },
  };
}

export async function deleteMessage(id: number): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const svc = createServerClient();
  const { error } = await svc.from("messages").delete().eq("id", id);
  return { ok: !error };
}
