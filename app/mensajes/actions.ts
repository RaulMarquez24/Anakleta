"use server";

import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { MAX_LEN, type ClanMessage } from "./shared";

export async function addMessage(text: string): Promise<{ ok: boolean; message?: ClanMessage }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
  if (!clean) return { ok: false };

  const svc = createServerClient();
  const { data, error } = await svc
    .from("messages")
    .insert({ text: clean, created_by: user.email ?? null })
    .select("id, text, created_by, created_at")
    .single();
  if (error || !data) return { ok: false };

  return {
    ok: true,
    message: {
      id: data.id as number,
      text: data.text as string,
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
