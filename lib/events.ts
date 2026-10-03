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

export async function getEvent(id: number): Promise<ClanEvent | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase.from("clan_events").select("*").eq("id", id).limit(1);
    const row = data?.[0];
    return row ? toEvent(row as Record<string, unknown>) : null;
  } catch {
    return null;
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

// Participaciones de UN evento, tal cual están guardadas (para ver cómo entró
// cada una: sola desde Discord o marcada a mano por un colíder).
export async function getEventParticipants(eventId: number): Promise<EventParticipant[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("clan_event_participants")
      .select("member_tag, discord_id, source, added_by, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .limit(500);
    return (data ?? []).map((r) => ({
      memberTag: (r.member_tag as string | null) ?? null,
      discordId: (r.discord_id as string | null) ?? null,
      source: (r.source as string) ?? "manual",
      addedBy: (r.added_by as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  } catch {
    return [];
  }
}

export interface ResolvedParticipant {
  tag: string | null; // null = vino de Discord y aún no tiene cuenta vinculada
  discordId: string | null;
  source: string; // 'manual' | 'cards' | …
  addedBy: string | null;
  createdAt: string;
}

// Participantes ya resueltos a cuentas del clan: una participación que entró por
// Discord vale para TODAS las cuentas de ese jugador, así que se expande.
export async function getResolvedParticipants(eventId: number): Promise<ResolvedParticipant[]> {
  const rows = await getEventParticipants(eventId);
  if (rows.length === 0) return [];
  const discordIds = [...new Set(rows.map((r) => r.discordId).filter((d): d is string => !!d))];
  const tagsOf = new Map<string, string[]>();
  if (discordIds.length > 0) {
    try {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("members")
        .select("tag, discord_id")
        .in("discord_id", discordIds);
      for (const m of data ?? []) {
        const d = m.discord_id as string;
        tagsOf.set(d, [...(tagsOf.get(d) ?? []), m.tag as string]);
      }
    } catch {
      /* sin migrar */
    }
  }
  const out: ResolvedParticipant[] = [];
  const vistos = new Set<string>();
  for (const r of rows) {
    const base = {
      discordId: r.discordId,
      source: r.source,
      addedBy: r.addedBy,
      createdAt: r.createdAt,
    };
    const tags = r.discordId ? (tagsOf.get(r.discordId) ?? []) : [];
    if (tags.length === 0 && r.memberTag) tags.push(r.memberTag);
    if (tags.length === 0) {
      out.push({ ...base, tag: null });
      continue;
    }
    for (const tag of tags) {
      if (vistos.has(tag)) continue;
      vistos.add(tag);
      out.push({ ...base, tag });
    }
  }
  return out;
}

// Nº de participantes de varios eventos de una vez. Cuenta igual que la ficha
// del evento: una participación de Discord vale por TODAS las cuentas de ese
// jugador, así que se expanden los vínculos antes de contar.
export async function getParticipantCounts(eventIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (eventIds.length === 0) return out;
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("clan_event_participants")
      .select("event_id, member_tag, discord_id")
      .in("event_id", eventIds)
      .limit(5000);
    const rows = data ?? [];
    const discordIds = [
      ...new Set(rows.map((r) => (r.discord_id as string | null) ?? "").filter(Boolean)),
    ];
    const tagsOf = new Map<string, string[]>();
    if (discordIds.length > 0) {
      const { data: links } = await supabase
        .from("members")
        .select("tag, discord_id")
        .in("discord_id", discordIds);
      for (const m of links ?? []) {
        const d = m.discord_id as string;
        tagsOf.set(d, [...(tagsOf.get(d) ?? []), m.tag as string]);
      }
    }
    const porEvento = new Map<number, Set<string>>();
    for (const r of rows) {
      const id = r.event_id as number;
      if (!porEvento.has(id)) porEvento.set(id, new Set());
      const set = porEvento.get(id)!;
      const d = (r.discord_id as string | null) ?? null;
      const vinculadas = d ? (tagsOf.get(d) ?? []) : [];
      if (vinculadas.length > 0) for (const t of vinculadas) set.add(t);
      else if (r.member_tag) set.add(r.member_tag as string);
      else if (d) set.add(`discord:${d}`); // aún sin vincular: cuenta como uno
    }
    for (const [id, set] of porEvento) out.set(id, set.size);
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
