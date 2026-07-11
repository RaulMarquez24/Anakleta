"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import {
  getCwlConfig,
  getList,
  refreshLiveList,
  sendOpenAnnouncement,
  assignCwlRole,
  removeCwlRole,
} from "@/lib/cwl";
import { deleteChannelMessage } from "@/lib/discord";

type Result = { ok: boolean; error?: string; season?: string };

async function gate() {
  const user = await getCurrentUser();
  return user?.email ?? null;
}

// Refresca la página de la liga afectada + el hub de Guerras.
function bump(season: string) {
  revalidatePath(`/liga/${season}`);
  revalidatePath("/guerras");
}

// Crea la inscripción de una liga. Una por mes; para una segunda del mismo mes
// (evento) marcar `event` -> se guarda con sufijo (AAAA-MM-2…). Si la liga YA ha
// empezado (tiene rondas o el inicio ya pasó), no se publica en Discord: queda
// solo para registro manual y en estado cerrado.
export async function createList(
  season: string,
  size: number | null,
  startsAt: string | null,
  event = false,
): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const raw = season.trim();
  if (!/^\d{4}-\d{2}/.test(raw)) return { ok: false, error: "Temporada inválida (usa AAAA-MM)." };

  const svc = createServerClient();
  const month = raw.slice(0, 7);
  const { data: rows } = await svc.from("cwl_lists").select("season").like("season", `${month}%`);
  const used = new Set((rows ?? []).map((r) => r.season as string));

  let target: string;
  if (raw.length > 7) target = raw; // temporada exacta (p. ej. evento ya nombrado)
  else if (event) {
    let n = 2;
    while (used.has(`${month}-${n}`)) n++;
    target = `${month}-${n}`;
  } else target = month;

  if (used.has(target)) {
    return {
      ok: false,
      error: event
        ? "Ya existe un evento con ese identificador."
        : "Ya existe una liga para ese mes. Marca «evento» si es una liga extra.",
    };
  }

  // ¿La liga ya empezó? -> no se publica en Discord (solo registro manual).
  const { data: warRow } = await svc
    .from("wars")
    .select("id")
    .eq("is_cwl", true)
    .eq("season", target)
    .limit(1);
  const started =
    Boolean(startsAt && new Date(startsAt).getTime() < Date.now()) || Boolean(warRow && warRow.length);

  const cfg = await getCwlConfig();
  const { error } = await svc.from("cwl_lists").insert({
    season: target,
    state: started ? "closed" : "open",
    size,
    starts_at: startsAt || null,
    channel_id: started ? null : cfg.listChannelId,
    created_by: email,
  });
  if (error) return { ok: false, error: error.message };
  if (!started) await refreshLiveList(target); // publica el mensaje fijo solo si no ha empezado
  bump(target);
  return { ok: true, season: target };
}

// Envía manualmente el anuncio de apertura (@Clan) al canal de avisos (#general).
export async function announceOpen(season: string): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const ok = await sendOpenAnnouncement(season);
  if (!ok) return { ok: false, error: "No se pudo enviar (revisa el canal de avisos)." };
  bump(season);
  return { ok: true };
}

export async function setState(season: string, state: "open" | "closed"): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { error } = await svc.from("cwl_lists").update({ state }).eq("season", season);
  if (error) return { ok: false, error: error.message };
  await refreshLiveList(season);
  bump(season);
  return { ok: true };
}

export async function setSize(season: string, size: number | null): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { error } = await svc.from("cwl_lists").update({ size }).eq("season", season);
  if (error) return { ok: false, error: error.message };
  await refreshLiveList(season);
  bump(season);
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
  bump(season);
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
  bump(season);
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
  bump(season);
  return { ok: true };
}

// Elimina la inscripción/liga entera (cwl_lists + sus inscritos en cascada) y
// borra el mensaje fijo de Discord. Solo para ligas sin empezar (lo controla la UI).
export async function deleteList(season: string): Promise<Result> {
  const email = await gate();
  if (!email) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const list = await getList(season);
  if (list?.channel_id && list?.message_id) {
    await deleteChannelMessage(list.channel_id, list.message_id).catch(() => {});
  }
  const { error } = await svc.from("cwl_lists").delete().eq("season", season);
  if (error) return { ok: false, error: error.message };
  bump(season);
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
  bump(season);
  return { ok: true };
}
