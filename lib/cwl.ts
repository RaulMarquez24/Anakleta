import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import {
  postChannelMessage,
  editChannelMessage,
  addGuildRole,
  removeGuildRole,
} from "@/lib/discord";

// ============================================================================
// Núcleo de las inscripciones de CWL por temporada. Fuente de verdad: la BD.
// La app (aquí) y el bot (bot/cwl.js) renderizan el MISMO texto para el mensaje
// fijo y comparten la lógica de corte 15→30. Mantener ambos en sintonía.
// ============================================================================

export interface CwlList {
  season: string;
  state: "open" | "closed";
  size: number | null; // null = corte dinámico 15→30
  opens_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  channel_id: string | null;
  message_id: string | null;
  announced_open: boolean;
  announced_mid: boolean;
  announced_last: boolean;
  roles_cleared: boolean;
  created_at: string;
  created_by: string | null;
}

export interface CwlSignupRow {
  id: number;
  season: string;
  discord_id: string | null;
  username: string | null;
  member_tag: string | null;
  source: string;
  added_by: string | null;
  created_at: string;
}

// Inscripción enriquecida con el jugador de CoC (si lo conocemos).
export interface CwlEntry extends CwlSignupRow {
  name: string; // nombre a mostrar (jugador de CoC o @username de Discord)
  townHall: number | null;
  memberTag: string | null; // tag del miembro resuelto (por member_tag o por discord)
  linked: boolean; // hay un miembro conocido (activo o no) asociado
  inClan: boolean; // ese miembro está activo en el clan ahora
  leftAt: string | null; // fecha de salida del clan (last_seen_at) si ya no está
}

export interface CwlPartition {
  cutoff: number;
  inside: CwlEntry[];
  queue: CwlEntry[];
  hidden: CwlEntry[]; // ex-miembros: siguen apuntados pero ocultos
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function seasonLabel(season: string): string {
  const m = season.match(/^(\d{4})-(\d{2})/);
  if (!m) return season;
  const suffix = season.length > 7 ? " · Evento" : "";
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}${suffix}`;
}

// --- Config (settings clave-valor, con fallback a env) ---

export interface CwlConfig {
  listChannelId: string | null;
  cwlRoleId: string | null;
  clanRoleId: string | null;
}

export async function getCwlConfig(): Promise<CwlConfig> {
  const svc = createServerClient();
  const { data } = await svc
    .from("settings")
    .select("key, value")
    .in("key", ["cwl_list_channel_id", "cwl_role_id", "clan_role_id"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  return {
    listChannelId: map.get("cwl_list_channel_id") || process.env.CWL_LIST_CHANNEL_ID || null,
    cwlRoleId: map.get("cwl_role_id") || process.env.CWL_ROLE_ID || null,
    clanRoleId: map.get("clan_role_id") || process.env.CLAN_ROLE_ID || null,
  };
}

// --- Listas ---

export async function getList(season: string): Promise<CwlList | null> {
  const svc = createServerClient();
  const { data } = await svc.from("cwl_lists").select("*").eq("season", season).maybeSingle();
  return (data as CwlList | null) ?? null;
}

// Lista "actual": la temporada más reciente (YYYY-MM ordena lexicográficamente).
export async function getActiveList(): Promise<CwlList | null> {
  const svc = createServerClient();
  const { data } = await svc
    .from("cwl_lists")
    .select("*")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CwlList | null) ?? null;
}

export async function listSeasons(): Promise<CwlList[]> {
  const svc = createServerClient();
  const { data } = await svc.from("cwl_lists").select("*").order("season", { ascending: false });
  return (data as CwlList[]) ?? [];
}

// ¿Se puede apuntar uno mismo? Abierta y la liga no ha terminado.
export function isOpenForSelf(list: CwlList | null): boolean {
  if (!list || list.state !== "open") return false;
  if (list.ends_at && Date.now() > new Date(list.ends_at).getTime()) return false;
  return true;
}

// --- Inscripciones enriquecidas ---

export async function getSignups(season: string): Promise<CwlEntry[]> {
  const svc = createServerClient();
  const [{ data: signups }, { data: members }] = await Promise.all([
    svc.from("cwl_signups").select("*").eq("season", season).order("created_at", { ascending: true }),
    svc.from("members").select("tag, name, town_hall, is_active, discord_id, last_seen_at"),
  ]);
  const byTag = new Map((members ?? []).map((m) => [m.tag as string, m]));
  const byDiscord = new Map(
    (members ?? []).filter((m) => m.discord_id).map((m) => [m.discord_id as string, m]),
  );

  return ((signups ?? []) as CwlSignupRow[]).map((s) => {
    const m = (s.member_tag && byTag.get(s.member_tag)) || (s.discord_id && byDiscord.get(s.discord_id)) || null;
    const inClan = m ? Boolean(m.is_active) : false;
    return {
      ...s,
      name: (m?.name as string) || s.username || "jugador",
      townHall: (m?.town_hall as number | null) ?? null,
      memberTag: (m?.tag as string | null) ?? s.member_tag ?? null,
      linked: Boolean(m),
      inClan,
      leftAt: m && !inClan ? ((m.last_seen_at as string | null) ?? null) : null,
    };
  });
}

// Corte dinámico: fijo si list.size, si no 15 (≤15) o 30 (16-30 y >30, con cola).
export function activeCutoff(list: CwlList, visibleCount: number): number {
  if (list.size) return list.size;
  return visibleCount <= 15 ? 15 : 30;
}

export function partition(list: CwlList, entries: CwlEntry[]): CwlPartition {
  // Ocultar ex-miembros SOLO en la inscripción presente (abierta y no terminada):
  // ahí no deben ocupar plaza. En una liga pasada cuentan (estuvieron inscritos,
  // aunque se fueran después).
  const present = isOpenForSelf(list);
  const hidden = present ? entries.filter((e) => e.linked && !e.inClan) : [];
  const visible = present ? entries.filter((e) => !(e.linked && !e.inClan)) : entries;
  const cutoff = activeCutoff(list, visible.length);
  return { cutoff, inside: visible.slice(0, cutoff), queue: visible.slice(cutoff), hidden };
}

// --- Render del mensaje fijo (debe coincidir con bot/cwl.js) ---

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return null;
  }
}

function entryLine(i: number, e: CwlEntry): string {
  const th = e.townHall ? ` · TH${e.townHall}` : "";
  const dot = e.discord_id ? "" : " 🎮"; // sin discord vinculado (añadido a mano)
  return `\`${String(i).padStart(2, " ")}.\` ${e.name}${th}${dot}`;
}

export function renderListText(list: CwlList, part: CwlPartition): string {
  const state = list.state === "open" ? "🟢 Abierta" : "🔒 Cerrada";
  const lines: string[] = [];
  lines.push(`📋 **Inscritos CWL · ${seasonLabel(list.season)}**`);
  lines.push(`${state} · ${part.inside.length}/${part.cutoff} plazas`);
  const close = fmtDate(list.starts_at);
  if (list.state === "open" && close) lines.push(`⏳ Cierre de inscripción: ${close}`);
  lines.push("");
  lines.push(`**✅ Dentro (${part.inside.length})**`);
  if (part.inside.length) part.inside.forEach((e, i) => lines.push(entryLine(i + 1, e)));
  else lines.push("_nadie todavía — escribe «me apunto»_");
  if (part.queue.length) {
    lines.push("");
    lines.push(`**⏳ En cola (${part.queue.length})** _(entran si se libera plaza)_`);
    part.queue.forEach((e, i) => lines.push(entryLine(i + 1, e)));
  }
  return lines.join("\n");
}

// --- Efectos: mensaje fijo en tiempo real + rol CWL ---

// Renderiza la lista y edita (o crea) el mensaje fijo del canal configurado.
export async function refreshLiveList(season: string): Promise<void> {
  const svc = createServerClient();
  const list = await getList(season);
  if (!list) return;
  const cfg = await getCwlConfig();
  const channelId = list.channel_id || cfg.listChannelId;
  if (!channelId) return;

  const part = partition(list, await getSignups(season));
  const content = renderListText(list, part);

  let messageId = list.message_id;
  const edited = messageId ? await editChannelMessage(channelId, messageId, content) : false;
  if (!edited) {
    messageId = await postChannelMessage(channelId, content);
  }
  if (messageId !== list.message_id || channelId !== list.channel_id) {
    await svc.from("cwl_lists").update({ message_id: messageId, channel_id: channelId }).eq("season", season);
  }
}

export async function assignCwlRole(discordId: string | null): Promise<void> {
  if (!discordId) return;
  const { cwlRoleId } = await getCwlConfig();
  if (cwlRoleId) await addGuildRole(discordId, cwlRoleId);
}

export async function removeCwlRole(discordId: string | null): Promise<void> {
  if (!discordId) return;
  const { cwlRoleId } = await getCwlConfig();
  if (cwlRoleId) await removeGuildRole(discordId, cwlRoleId);
}
