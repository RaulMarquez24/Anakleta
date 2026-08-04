import { createServerClient } from "@/lib/supabase/server";

// Evento del clan (uno activo a la vez). Solo deja constancia de quién participó
// y suma un pequeño plus para los ascensos; nunca penaliza.
export interface ClanEvent {
  id: number;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
  autoSource: string | null; // 'cards' u otra mecánica de Discord
  active: boolean;
  createdAt: string;
}

export interface EventParticipant {
  memberTag: string | null;
  discordId: string | null;
  source: string;
  addedBy: string | null;
  createdAt: string;
}

function toEvent(r: Record<string, unknown>): ClanEvent {
  return {
    id: r.id as number,
    name: (r.name as string) ?? "",
    startsAt: (r.starts_at as string | null) ?? null,
    endsAt: (r.ends_at as string | null) ?? null,
    autoSource: (r.auto_source as string | null) ?? null,
    active: Boolean(r.active),
    createdAt: r.created_at as string,
  };
}

// Evento activo (el más reciente marcado como activo). null si no hay ninguno.
export async function getActiveEvent(): Promise<ClanEvent | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("clan_events")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    return row ? toEvent(row as Record<string, unknown>) : null;
  } catch {
    return null; // tabla sin migrar
  }
}

export async function getEvents(limit = 50): Promise<ClanEvent[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("clan_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []).map((r) => toEvent(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

// Tags de los que participaron en un evento. Los que entraron por Discord sin
// tag se resuelven con el vínculo guardado en `members.discord_id`.
export async function getParticipantTags(eventId: number): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("clan_event_participants")
      .select("member_tag, discord_id")
      .eq("event_id", eventId)
      .limit(500);
    const sinTag: string[] = [];
    for (const r of data ?? []) {
      const tag = (r.member_tag as string | null) ?? null;
      if (tag) out.add(tag);
      else if (r.discord_id) sinTag.push(r.discord_id as string);
    }
    if (sinTag.length > 0) {
      const { data: links } = await supabase
        .from("members")
        .select("tag, discord_id")
        .in("discord_id", sinTag);
      for (const m of links ?? []) out.add(m.tag as string);
    }
  } catch {
    /* sin migrar */
  }
  return out;
}

// Participaciones de un jugador (para su ficha): en qué eventos estuvo.
export async function getMemberEvents(
  tag: string,
  discordId?: string | null,
): Promise<{ event: ClanEvent; source: string }[]> {
  try {
    const supabase = createServerClient();
    const ors = [`member_tag.eq.${tag}`];
    if (discordId) ors.push(`discord_id.eq.${discordId}`);
    const { data } = await supabase
      .from("clan_event_participants")
      .select("event_id, source")
      .or(ors.join(","))
      .limit(200);
    const ids = [...new Set((data ?? []).map((r) => r.event_id as number))];
    if (ids.length === 0) return [];
    const { data: evs } = await supabase.from("clan_events").select("*").in("id", ids);
    const byId = new Map(
      (evs ?? []).map((e) => [e.id as number, toEvent(e as Record<string, unknown>)]),
    );
    return (data ?? [])
      .map((r) => {
        const ev = byId.get(r.event_id as number);
        return ev ? { event: ev, source: (r.source as string) ?? "manual" } : null;
      })
      .filter((x): x is { event: ClanEvent; source: string } => x != null)
      .sort((a, b) => b.event.createdAt.localeCompare(a.event.createdAt));
  } catch {
    return [];
  }
}
