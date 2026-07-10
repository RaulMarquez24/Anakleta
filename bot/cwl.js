// Núcleo de inscripciones CWL para el bot (espejo de lib/cwl.ts de la app).
// Comparte BD (Supabase) y produce EXACTAMENTE el mismo texto del mensaje fijo.
// Si tocas el render en un lado, replícalo en el otro.

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID;

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function seasonLabel(season) {
  const m = season.match(/^(\d{4})-(\d{2})/);
  if (!m) return season;
  const suffix = season.length > 7 ? " · Evento" : "";
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}${suffix}`;
}

// --- Discord REST (mensaje fijo + rol) ---

async function postMessage(channelId, content) {
  if (!TOKEN || !channelId) return null;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) return null;
    const msg = await res.json();
    return msg.id ?? null;
  } catch {
    return null;
  }
}

async function editMessage(channelId, messageId, content) {
  if (!TOKEN || !channelId || !messageId) return false;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function roleOp(method, userId, roleId) {
  if (!TOKEN || !GUILD || !userId || !roleId) return false;
  try {
    const res = await fetch(`${API}/guilds/${GUILD}/members/${userId}/roles/${roleId}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Config (settings clave-valor, con fallback a env) ---

export async function getConfig(db) {
  const { data } = await db
    .from("settings")
    .select("key, value")
    .in("key", ["cwl_list_channel_id", "cwl_role_id", "clan_role_id"]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    listChannelId: map.get("cwl_list_channel_id") || process.env.CWL_LIST_CHANNEL_ID || null,
    cwlRoleId: map.get("cwl_role_id") || process.env.CWL_ROLE_ID || null,
    clanRoleId: map.get("clan_role_id") || process.env.CLAN_ROLE_ID || null,
  };
}

// --- Listas ---

export async function getActiveList(db) {
  const { data } = await db
    .from("cwl_lists")
    .select("*")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getList(db, season) {
  const { data } = await db.from("cwl_lists").select("*").eq("season", season).maybeSingle();
  return data ?? null;
}

export function isOpenForSelf(list) {
  if (!list || list.state !== "open") return false;
  if (list.ends_at && Date.now() > new Date(list.ends_at).getTime()) return false;
  return true;
}

// --- Inscripciones enriquecidas ---

export async function getSignups(db, season) {
  const [{ data: signups }, { data: members }] = await Promise.all([
    db.from("cwl_signups").select("*").eq("season", season).order("created_at", { ascending: true }),
    db.from("members").select("tag, name, town_hall, is_active, discord_id, main_tag"),
  ]);
  const byTag = new Map((members ?? []).map((m) => [m.tag, m]));
  const byDiscord = new Map((members ?? []).filter((m) => m.discord_id).map((m) => [m.discord_id, m]));

  return (signups ?? []).map((s) => {
    const m = (s.member_tag && byTag.get(s.member_tag)) || (s.discord_id && byDiscord.get(s.discord_id)) || null;
    return {
      ...s,
      name: m?.name || s.username || "jugador",
      townHall: m?.town_hall ?? null,
      linked: Boolean(m),
      inClan: m ? Boolean(m.is_active) : false,
      isSecondary: Boolean(m?.main_tag),
      mainTag: m?.main_tag ?? null,
    };
  });
}

export function activeCutoff(list, visibleCount) {
  if (list.size) return list.size;
  return visibleCount <= 15 ? 15 : 30;
}

export function partition(list, entries) {
  // Ocultar ex-miembros SOLO en la inscripción presente (abierta y no terminada).
  // En una liga pasada cuentan (estuvieron inscritos aunque se fueran después).
  const present = isOpenForSelf(list);
  const hidden = present ? entries.filter((e) => e.linked && !e.inClan) : [];
  const visible = present ? entries.filter((e) => !(e.linked && !e.inClan)) : entries;

  // "Secundaria" es relativo a la persona: solo si tiene 2+ cuentas apuntadas.
  // Agrupamos por persona (mismo Discord, o misma cuenta principal).
  const secondaryIds = new Set();
  const groups = new Map();
  for (const e of visible) {
    const key = e.discord_id ? `d:${e.discord_id}` : e.linked ? `m:${e.mainTag ?? e.member_tag}` : `x:${e.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const g of groups.values()) {
    if (g.length <= 1) continue;
    let primaryIdx = g.findIndex((e) => !e.isSecondary);
    if (primaryIdx < 0) primaryIdx = 0;
    g.forEach((e, i) => i !== primaryIdx && secondaryIds.add(e.id));
  }

  // Principales primero (prioridad del resto de gente); secundarias con lo que sobre.
  const primaries = visible.filter((e) => !secondaryIds.has(e.id));
  const secondaries = visible.filter((e) => secondaryIds.has(e.id));
  const cutoff = activeCutoff(list, visible.length);
  const inside = primaries.slice(0, cutoff);
  const queue = primaries.slice(cutoff);
  const secondaryCutoff = Math.max(0, cutoff - inside.length);
  return { cutoff, inside, queue, secondaries, secondaryCutoff, hidden };
}

// --- Render (debe coincidir con lib/cwl.ts) ---

function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return null;
  }
}

function entryLine(i, e, queued = false) {
  const num = `\`${String(i).padStart(2, " ")}\``;
  const th = e.townHall ? ` · TH${e.townHall}` : "";
  const noDiscord = e.discord_id ? "" : " · 🎮";
  const tail = queued ? " · ⏳" : "";
  return `${num} ${e.name}${th}${noDiscord}${tail}`;
}

// Texto del mensaje fijo. DEBE coincidir con lib/cwl.ts (lo editan los dos).
export function renderListText(list, part) {
  const open = list.state === "open";
  const stateTxt = open ? "🟢 Inscripción abierta" : "🔒 Inscripción cerrada";
  const occupied = part.inside.length + Math.min(part.secondaries.length, part.secondaryCutoff);
  const close = open ? fmtDate(list.starts_at) : null;

  const L = [];
  L.push(`## 🏆 Liga de Clanes · ${seasonLabel(list.season)}`);
  L.push(`-# ${stateTxt}  ·  ${occupied}/${part.cutoff} plazas${close ? `  ·  cierra el ${close}` : ""}`);
  L.push("");

  L.push(`**✅ Dentro** · ${part.inside.length}`);
  if (part.inside.length) part.inside.forEach((e, i) => L.push(entryLine(i + 1, e)));
  else L.push("-# nadie todavía");

  if (part.secondaries.length) {
    L.push("");
    L.push(`**➕ Secundarias** · ${part.secondaries.length}`);
    L.push("-# menor prioridad: entran con las plazas que sobren");
    part.secondaries.forEach((e, i) => L.push(entryLine(i + 1, e, i >= part.secondaryCutoff)));
  }

  if (part.queue.length) {
    L.push("");
    L.push(`**⏳ En cola** · ${part.queue.length}`);
    part.queue.forEach((e, i) => L.push(entryLine(i + 1, e, true)));
  }

  L.push("");
  L.push("-# 📣 Para apuntarte escribe «me apunto» o usa `/apuntar` · esta lista se actualiza sola");
  return L.join("\n");
}

// --- Efectos ---

export async function refreshLiveList(db, season) {
  const list = await getList(db, season);
  if (!list) return;
  const cfg = await getConfig(db);
  const channelId = list.channel_id || cfg.listChannelId;
  if (!channelId) return;

  const part = partition(list, await getSignups(db, season));
  const content = renderListText(list, part);

  let messageId = list.message_id;
  const edited = messageId ? await editMessage(channelId, messageId, content) : false;
  if (!edited) messageId = await postMessage(channelId, content);
  if (messageId !== list.message_id || channelId !== list.channel_id) {
    await db.from("cwl_lists").update({ message_id: messageId, channel_id: channelId }).eq("season", season);
  }
}

export async function assignRole(db, discordId) {
  if (!discordId) return;
  const { cwlRoleId } = await getConfig(db);
  if (cwlRoleId) await roleOp("PUT", discordId, cwlRoleId);
}

export async function removeRole(db, discordId) {
  if (!discordId) return;
  const { cwlRoleId } = await getConfig(db);
  if (cwlRoleId) await roleOp("DELETE", discordId, cwlRoleId);
}

// --- Altas / bajas / consulta (temporada activa) ---

export async function isSignedUp(db, season, discordId) {
  // limit(1) en vez de maybeSingle(): un mismo Discord puede tener varias filas
  // (principal + secundarias) y maybeSingle() falla si hay más de una.
  const { data } = await db
    .from("cwl_signups")
    .select("id")
    .eq("season", season)
    .eq("discord_id", discordId)
    .limit(1);
  return Boolean(data && data.length);
}

export async function addSignup(db, season, { discordId, username, memberTag = null }) {
  const { error } = await db.from("cwl_signups").insert({
    season,
    discord_id: discordId,
    username,
    member_tag: memberTag,
    source: "discord",
    added_by: "self",
  });
  if (error) {
    console.error("[db] addSignup error:", error.message);
    throw error;
  }
}

// Cuentas del clan (activas) que pertenecen a un usuario de Discord: las
// vinculadas directamente (discord_id) + sus secundarias (main_tag apunta a
// alguna de ellas). Mains primero. Sirve para preguntar cuáles apuntar.
export async function getAccountsForDiscord(db, discordId) {
  const { data: direct } = await db
    .from("members")
    .select("tag, name, town_hall, main_tag, is_active")
    .eq("discord_id", discordId)
    .eq("is_active", true);
  const accounts = [...(direct ?? [])];
  const seen = new Set(accounts.map((a) => a.tag));
  const tags = [...seen];
  if (tags.length) {
    const { data: secs } = await db
      .from("members")
      .select("tag, name, town_hall, main_tag, is_active")
      .in("main_tag", tags)
      .eq("is_active", true);
    for (const s of secs ?? []) {
      if (!seen.has(s.tag)) {
        accounts.push(s);
        seen.add(s.tag);
      }
    }
  }
  // Mains (sin main_tag) primero, luego por nombre.
  accounts.sort((a, b) => (a.main_tag ? 1 : 0) - (b.main_tag ? 1 : 0) || String(a.name).localeCompare(String(b.name), "es"));
  return accounts.map((a) => ({ tag: a.tag, name: a.name, town_hall: a.town_hall }));
}

// Apunta varias cuentas concretas (por tag) de un mismo Discord. Evita duplicar
// las que ya estén en esa temporada. Devuelve nombres añadidos / ya existentes.
export async function addAccounts(db, season, discordId, accounts) {
  const { data: existing } = await db
    .from("cwl_signups")
    .select("member_tag")
    .eq("season", season)
    .not("member_tag", "is", null);
  const have = new Set((existing ?? []).map((r) => r.member_tag));
  const toAdd = accounts.filter((a) => !have.has(a.tag));
  if (toAdd.length) {
    const rows = toAdd.map((a) => ({
      season,
      member_tag: a.tag,
      discord_id: discordId,
      username: a.name,
      source: "discord",
      added_by: "self",
    }));
    const { error } = await db.from("cwl_signups").insert(rows);
    if (error) {
      console.error("[db] addAccounts error:", error.message);
      throw error;
    }
  }
  return {
    added: toAdd.map((a) => a.name),
    already: accounts.filter((a) => have.has(a.tag)).map((a) => a.name),
  };
}

export async function removeSignup(db, season, discordId) {
  const { error } = await db
    .from("cwl_signups")
    .delete()
    .eq("season", season)
    .eq("discord_id", discordId);
  if (error) {
    console.error("[db] removeSignup error:", error.message);
    throw error;
  }
}
