"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";

// Crea un evento y lo deja como el activo (solo uno a la vez: cierra los demás).
export async function createEvent(input: {
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  autoSource?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Ponle un nombre al evento." };

  const svc = createServerClient();
  await svc.from("clan_events").update({ active: false }).eq("active", true);
  const { error } = await svc.from("clan_events").insert({
    name,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
    auto_source: input.autoSource || null,
    active: true,
    created_by: user.email ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/eventos");
  revalidatePath("/actividad");
  return { ok: true };
}

// Edita el evento: nombre, fechas y si su participación se marca sola desde
// alguna mecánica de Discord (ahora mismo, las cartas).
export async function saveEvent(
  id: number,
  input: {
    name: string;
    startsAt?: string | null;
    endsAt?: string | null;
    autoSource?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Ponle un nombre al evento." };

  const svc = createServerClient();
  const { error } = await svc
    .from("clan_events")
    .update({
      name,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      auto_source: input.autoSource || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${id}`);
  revalidatePath("/actividad");
  return { ok: true };
}

// Cierra un evento (deja de ser el activo). Su historial se conserva.
export async function closeEvent(id: number): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  const { error } = await svc.from("clan_events").update({ active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${id}`);
  revalidatePath("/actividad");
  return { ok: true };
}

// Vuelve a activar un evento cerrado (y cierra el que estuviera activo).
export async function reopenEvent(id: number): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const svc = createServerClient();
  await svc.from("clan_events").update({ active: false }).eq("active", true);
  const { error } = await svc.from("clan_events").update({ active: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${id}`);
  revalidatePath("/actividad");
  return { ok: true };
}

// Marca (o desmarca) manualmente la participación de varios jugadores.
export async function setParticipants(
  eventId: number,
  tags: string[],
  participa: boolean,
): Promise<{ ok: boolean; error?: string; n?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado." };
  const list = tags.filter(Boolean).slice(0, 100);
  if (list.length === 0) return { ok: false, error: "Ningún jugador seleccionado." };

  const svc = createServerClient();
  if (!participa) {
    const { error } = await svc
      .from("clan_event_participants")
      .delete()
      .eq("event_id", eventId)
      .in("member_tag", list);
    if (error) return { ok: false, error: error.message };
    // Si la participación entró por Discord, vale para todas las cuentas de ese
    // jugador: al quitarla hay que borrar también la fila de su Discord, o
    // volvería a aparecer marcado.
    const { data: links } = await svc
      .from("members")
      .select("discord_id")
      .in("tag", list)
      .not("discord_id", "is", null);
    const ids = [...new Set((links ?? []).map((m) => m.discord_id as string))];
    if (ids.length > 0) {
      await svc
        .from("clan_event_participants")
        .delete()
        .eq("event_id", eventId)
        .in("discord_id", ids);
    }
  } else {
    // Se insertan solo los que falten: los índices únicos de la tabla son
    // PARCIALES (member_tag not null) y Postgres no los admite en un ON CONFLICT
    // (error 42P10), así que un upsert aquí fallaría siempre.
    const { data: ya } = await svc
      .from("clan_event_participants")
      .select("member_tag")
      .eq("event_id", eventId)
      .in("member_tag", list);
    const puestos = new Set((ya ?? []).map((r) => r.member_tag as string));
    const nuevos = list.filter((t) => !puestos.has(t));
    if (nuevos.length > 0) {
      const { error } = await svc.from("clan_event_participants").insert(
        nuevos.map((tag) => ({
          event_id: eventId,
          member_tag: tag,
          source: "manual",
          added_by: user.email ?? null,
        })),
      );
      if (error) return { ok: false, error: error.message };
    }
  }
  revalidatePath("/eventos");
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath("/actividad");
  return { ok: true, n: list.length };
}
