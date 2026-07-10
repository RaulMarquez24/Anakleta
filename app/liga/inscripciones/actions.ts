"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import {
  getCwlConfig,
  refreshLiveList,
  assignCwlRole,
  removeCwlRole,
} from "@/lib/cwl";

type Result = { ok: boolean; error?: string };

const PATH = "/liga/inscripciones";

async function gate() {
  const user = await getCurrentUser();
  return user?.email ?? null;
}

// Crea la lista de una temporada (si no existe) y publica el mensaje fijo.
export async function createList(
  season: string,
  size: number | null,
  startsAt: string | null,
): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const s = season.trim();
  if (!/^\d{4}-\d{2}/.test(s)) return { ok: false, error: "Temporada inválida (usa AAAA-MM)." };

  const svc = createServerClient();
  const cfg = await getCwlConfig();
  const { error } = await svc.from("cwl_lists").insert({
    season: s,
    state: "open",
    size,
    starts_at: startsAt || null,
    channel_id: cfg.listChannelId,
    created_by: email,
  });
  if (error) return { ok: false, error: error.message };
  await refreshLiveList(s);
  revalidatePath(PATH);
  return { ok: true };
}

export async function setState(season: string, state: "open" | "closed"): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { error } = await svc.from("cwl_lists").update({ state }).eq("season", season);
  if (error) return { ok: false, error: error.message };
  await refreshLiveList(season);
  revalidatePath(PATH);
  return { ok: true };
}

export async function setSize(season: string, size: number | null): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { error } = await svc.from("cwl_lists").update({ size }).eq("season", season);
  if (error) return { ok: false, error: error.message };
  await refreshLiveList(season);
  revalidatePath(PATH);
  return { ok: true };
}

export async function setDates(
  season: string,
  dates: { opens_at?: string | null; starts_at?: string | null; ends_at?: string | null },
): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const patch: Record<string, string | null> = {};
  if ("opens_at" in dates) patch.opens_at = dates.opens_at || null;
  if ("starts_at" in dates) patch.starts_at = dates.starts_at || null;
  if ("ends_at" in dates) patch.ends_at = dates.ends_at || null;
  const { error } = await svc.from("cwl_lists").update(patch).eq("season", season);
  if (error) return { ok: false, error: error.message };
  await refreshLiveList(season);
  revalidatePath(PATH);
  return { ok: true };
}

// Apunta a un miembro del clan (por tag). Guarda su discord (si lo tiene) y rol.
export async function addSignupMember(season: string, memberTag: string): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { data: m } = await svc
    .from("members")
    .select("tag, name, discord_id, discord_username")
    .eq("tag", memberTag)
    .maybeSingle();
  if (!m) return { ok: false, error: "Miembro no encontrado." };

  const { error } = await svc.from("cwl_signups").insert({
    season,
    member_tag: m.tag,
    discord_id: (m.discord_id as string | null) ?? null,
    username: (m.discord_username as string | null) ?? (m.name as string),
    source: "app",
    added_by: email,
  });
  if (error) return { ok: false, error: error.message };
  await assignCwlRole((m.discord_id as string | null) ?? null);
  await refreshLiveList(season);
  revalidatePath(PATH);
  return { ok: true };
}

// Apunta a alguien por su cuenta de Discord (sin miembro de clan asociado).
export async function addSignupDiscord(
  season: string,
  discordId: string,
  username: string,
): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { error } = await svc.from("cwl_signups").insert({
    season,
    discord_id: discordId,
    username,
    source: "app",
    added_by: email,
  });
  if (error) return { ok: false, error: error.message };
  await assignCwlRole(discordId);
  await refreshLiveList(season);
  revalidatePath(PATH);
  return { ok: true };
}

export async function removeSignup(season: string, signupId: number): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { data: row } = await svc
    .from("cwl_signups")
    .select("discord_id")
    .eq("id", signupId)
    .maybeSingle();
  const { error } = await svc.from("cwl_signups").delete().eq("id", signupId);
  if (error) return { ok: false, error: error.message };
  await removeCwlRole((row?.discord_id as string | null) ?? null);
  await refreshLiveList(season);
  revalidatePath(PATH);
  return { ok: true };
}
