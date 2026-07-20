// Bot de Discord del clan Añakleta. Proceso 24/7 (Fly.io) conectado al gateway.
// Comparte la BD de Supabase con la app (misma service key).
//
// Inscripción a la CWL atada a la temporada activa (ver bot/cwl.js), de dos formas:
//  1) Texto libre en el canal de inscripciones ("me apunto", "me desapunto",
//     "¿estoy apuntado?", "quién hay", "¿cómo me apunto?") -> tolerante a erratas.
//  2) Slash commands (en cualquier canal): /apuntar, /desapuntar, /lista-cwl, /help.

import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ActivityType,
} from "discord.js";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { classifyIntent } from "./match.js";
import * as cwl from "./cwl.js";
import * as coc from "./coc.js";

// Súbelo cuando cambies algo. En `fly logs` verás esta línea al arrancar: si NO
// cambia tras un deploy, es que el deploy no ha subido el código nuevo.
const BOT_VERSION = "v15 participo";

// Texto de ayuda, compartido por «¿cómo me apunto?» (texto libre) y /help.
const HELP_TEXT =
  "ℹ️ **Cómo funciona la CWL por aquí:**\n" +
  "• Para **entrar**, escribe «participo» (o usa `/apuntar`) y reaccionaré con ✅.\n" +
  "• Para **ver quién hay**, escribe «quién hay en la lista» o usa `/lista-cwl`.\n" +
  "• Para **comprobar** si estás tú, escribe «¿estoy apuntado?».\n" +
  "• Para **salir**, escribe «me desapunto» (o usa `/desapuntar`).";

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID, // opcional: registra los comandos al instante en este servidor
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  SIGNUP_CHANNEL_ID, // opcional: uno o varios canales (separados por comas)
} = process.env;

// Lista de canales donde escuchar texto libre. Vacío = todos los canales.
const SIGNUP_CHANNELS = (SIGNUP_CHANNEL_ID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!DISCORD_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Faltan variables: DISCORD_BOT_TOKEN, SUPABASE_URL, SUPABASE_SECRET_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // privilegiado: para el evento de "usuario entró"
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privilegiado: activar en el portal
    GatewayIntentBits.DirectMessages, // recibir DMs (flujo de identificación)
  ],
  partials: [Partials.Channel],
});

// Charset de un tag de CoC (sin la almohadilla). Sirve para detectarlo en un DM.
const TAG_RE = /#?([0289PYLQGRJCUV]{5,10})/i;

// --- Lógica de inscripción (compartida por texto libre y slash) ---

// Texto de la lista actual (mismo render que el mensaje fijo).
async function listReply() {
  const list = await cwl.getActiveList(db);
  if (!list) return "📋 No hay ninguna lista de CWL abierta todavía.";
  const part = cwl.partition(list, await cwl.getSignups(db, list.season));
  return cwl.renderListText(list, part);
}

// Aviso según dónde quedó el usuario (principal dentro/cola o secundaria).
async function queueNote(list, discordId) {
  const part = cwl.partition(list, await cwl.getSignups(db, list.season));
  if (part.inside.some((e) => e.discord_id === discordId)) return null; // principal con plaza
  const s = part.secondaries.findIndex((e) => e.discord_id === discordId);
  if (s >= 0) {
    return s < part.secondaryCutoff
      ? "➕ Apuntado como **secundaria** (con plaza; los principales tienen prioridad)."
      : "➕ Apuntado como **secundaria**, en cola (entra si sobran plazas).";
  }
  const q = part.queue.findIndex((e) => e.discord_id === discordId);
  if (q >= 0) return `⏳ Estás en **cola** (puesto ${q + 1}); entrarás si se libera una plaza.`;
  return null;
}

// Menú de selección de cuentas (cuando el usuario tiene varias vinculadas).
function pickRow(season, discordId, accounts) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`cwl_pick:${season}:${discordId}`)
    .setPlaceholder("¿Qué cuentas apuntas a la CWL?")
    .setMinValues(1)
    .setMaxValues(accounts.length)
    .addOptions(
      accounts.map((a) => ({
        label: a.town_hall ? `${a.name} (TH${a.town_hall})` : a.name,
        value: a.tag,
      })),
    );
  return new ActionRowBuilder().addComponents(menu);
}

// Menú para elegir qué cuentas QUITAR (baja). value = id de la inscripción.
function unpickRow(season, discordId, accounts) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`cwl_unpick:${season}:${discordId}`)
    .setPlaceholder("¿Qué cuentas quitas de la CWL?")
    .setMinValues(1)
    .setMaxValues(accounts.length)
    .addOptions(accounts.map((a) => ({ label: a.name, value: String(a.id) })));
  return new ActionRowBuilder().addComponents(menu);
}

// Resultado: { text?, react?, pick? }. `pick` = hay que preguntar qué cuentas.
async function doSignup(id, username) {
  const list = await cwl.getActiveList(db);
  if (!list) return { text: "🚫 Las inscripciones de CWL no están abiertas todavía." };
  if (!cwl.isOpenForSelf(list)) {
    return { text: "🔒 La inscripción individual está cerrada. Pídele a un colíder que te apunte." };
  }

  // ¿Tiene varias cuentas del clan? -> preguntar cuáles apuntar.
  const accounts = await cwl.getAccountsForDiscord(db, id);
  if (accounts.length >= 2) {
    return { pick: { season: list.season, accounts } };
  }

  if (await cwl.isSignedUp(db, list.season, id)) {
    return { text: "☑️ Ya estás apuntado a la CWL. Mira la lista con `/lista-cwl`." };
  }
  const acc = accounts[0] ?? null;
  await cwl.addSignup(db, list.season, {
    discordId: id,
    username: acc?.name ?? username,
    memberTag: acc?.tag ?? null,
  });
  await cwl.assignRole(db, id);
  await cwl.refreshLiveList(db, list.season);
  const note = await queueNote(list, id);
  return { react: "✅", text: note ?? undefined };
}

// Registra las cuentas elegidas en el menú de selección.
async function applyPick(season, discordId, tags) {
  const accounts = await cwl.getAccountsForDiscord(db, discordId);
  const chosen = accounts.filter((a) => tags.includes(a.tag));
  const r = await cwl.addAccounts(db, season, discordId, chosen);
  await cwl.assignRole(db, discordId);
  await cwl.refreshLiveList(db, season);
  const parts = [];
  if (r.added.length) parts.push(`✅ Apuntado: ${r.added.join(", ")}`);
  if (r.already.length) parts.push(`ℹ️ Ya estaban: ${r.already.join(", ")}`);
  return parts.join(" · ") || "Sin cambios.";
}

async function doUnsignup(id) {
  const list = await cwl.getActiveList(db);
  if (!list) return { text: "ℹ️ No estabas apuntado a la CWL." };
  const mine = await cwl.getMySignups(db, list.season, id);
  if (mine.length === 0) return { text: "ℹ️ No estabas apuntado a la CWL." };

  // Varias cuentas -> preguntar cuáles quitar (no sacar todas de golpe).
  if (mine.length >= 2) {
    return { pickRemove: { season: list.season, accounts: mine } };
  }

  await cwl.removeSignup(db, list.season, id);
  await cwl.removeRole(db, id);
  await cwl.refreshLiveList(db, list.season);
  return { react: "👋", text: "👋 Te he quitado de la CWL." };
}

// Aplica la baja de las cuentas elegidas en el menú. Solo quita el rol si ya no
// le queda ninguna cuenta apuntada.
async function applyUnpick(season, discordId, ids) {
  const mine = await cwl.getMySignups(db, season, discordId);
  const idNums = ids.map(Number);
  const names = mine.filter((m) => idNums.includes(m.id)).map((m) => m.name);
  await cwl.removeSignupsByIds(db, idNums);
  if ((await cwl.countMySignups(db, season, discordId)) === 0) await cwl.removeRole(db, discordId);
  await cwl.refreshLiveList(db, season);
  return `👋 Quitado: ${names.join(", ") || "nada"}.`;
}

async function doStatus(id) {
  const list = await cwl.getActiveList(db);
  const yes = list && (await cwl.isSignedUp(db, list.season, id));
  return yes
    ? "✅ Sí, estás apuntado a la CWL. Consulta la lista con `/lista-cwl`."
    : "❌ No estás apuntado. Escribe «participo» o usa `/apuntar`.";
}

// --- Slash commands ---

const COMMANDS = [
  { name: "apuntar", description: "Apuntarte a la Liga de Clanes (CWL)" },
  { name: "desapuntar", description: "Salir de la Liga de Clanes (CWL)" },
  { name: "lista-cwl", description: "Ver la lista de inscritos a la CWL" },
  { name: "help", description: "Cómo funciona la inscripción a la CWL" },
];

// Estado compartido para la landing/health (se rellena en updatePresence).
const BOOT_MS = Date.now();
let lastPresenceText = "Arrancando…";
let lastClan = null;
let lastWar = null;

// --- Estado dinámico (lo que se ve bajo el nombre del bot) ---
// En guerra: "⚔️ En guerra vs X". Preparación: "🛡️ Preparando guerra".
// Si no: "👀 Añakleta · N/50". Se refresca solo cada pocos minutos.
async function updatePresence(c) {
  try {
    const [war, clan] = await Promise.all([
      coc.getCurrentWar().catch(() => null),
      coc.getClan().catch(() => null),
    ]);
    if (clan) lastClan = clan;
    lastWar = war;
    let text;
    if (war?.state === "inWar" && war.opponent?.name) {
      const cs = war.clan?.stars ?? 0;
      const os = war.opponent?.stars ?? 0;
      text = `⚔️ Guerra vs ${war.opponent.name} (${cs}-${os})`;
    } else if (war?.state === "preparation") {
      text = `🛡️ Preparando la guerra`;
    } else if (clan?.members != null) {
      text = `👀 ${clan.name ?? "Añakleta"} · ${clan.members}/50`;
    } else {
      text = `👀 Vigilando el clan`;
    }
    lastPresenceText = text;
    c.user.setPresence({
      status: "online",
      activities: [{ name: text, type: ActivityType.Custom, state: text }],
    });
  } catch (err) {
    console.error("[presence]", err?.message ?? err);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot conectado como ${c.user.tag} — ${BOT_VERSION}`);
  console.log(`DISCORD_GUILD_ID=${DISCORD_GUILD_ID ?? "(sin definir)"}`);
  // Estado dinámico: ahora y cada 5 minutos.
  updatePresence(c);
  setInterval(() => updatePresence(c), 5 * 60_000);
  try {
    // Registro GLOBAL: así los comandos salen en el perfil del bot ("Comandos")
    // y en todos los servidores. La 1ª vez tarda ~1h en propagarse.
    // Si antes se registraron por servidor, se limpian para no duplicarlos.
    if (DISCORD_GUILD_ID) {
      await c.application.commands.set([], DISCORD_GUILD_ID).catch(() => {});
    }
    const set = await c.application.commands.set(COMMANDS);
    const names = set.map((cmd) => `/${cmd.name}`).join(", ");
    console.log(`Slash commands registrados globalmente (tardan ~1h la 1ª vez): ${names}`);
  } catch (err) {
    console.error("No se pudieron registrar los slash commands:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  const eph = MessageFlags.Ephemeral;

  // Menú de selección de cuentas ("me apunto" con varias cuentas).
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("cwl_pick:")) {
    const [, season, uid] = interaction.customId.split(":");
    if (interaction.user.id !== uid) {
      await interaction.reply({ content: "Este menú no es para ti 🙂", flags: eph }).catch(() => {});
      return;
    }
    try {
      const text = await applyPick(season, uid, interaction.values);
      await interaction.update({ content: text, components: [] });
    } catch {
      await interaction.reply({ content: "⚠️ No se pudo apuntar. Inténtalo de nuevo.", flags: eph }).catch(() => {});
    }
    return;
  }

  // Menú de baja de cuentas ("me desapunto" con varias cuentas).
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("cwl_unpick:")) {
    const [, season, uid] = interaction.customId.split(":");
    if (interaction.user.id !== uid) {
      await interaction.reply({ content: "Este menú no es para ti 🙂", flags: eph }).catch(() => {});
      return;
    }
    try {
      const text = await applyUnpick(season, uid, interaction.values);
      await interaction.update({ content: text, components: [] });
    } catch {
      await interaction.reply({ content: "⚠️ No se pudo quitar. Inténtalo de nuevo.", flags: eph }).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const id = interaction.user.id;
  const username = interaction.user.username;
  try {
    if (interaction.commandName === "apuntar") {
      const r = await doSignup(id, username);
      if (r.pick) {
        await interaction.reply({
          content: "Tienes varias cuentas vinculadas. Elige cuáles apuntar:",
          components: [pickRow(r.pick.season, id, r.pick.accounts)],
          flags: eph,
        });
        return;
      }
      const msg = r.react ? `✅ ¡Apuntado a la CWL!${r.text ? `\n${r.text}` : ""}` : r.text;
      await interaction.reply({ content: msg, flags: eph });
      return;
    }
    if (interaction.commandName === "desapuntar") {
      const r = await doUnsignup(id);
      if (r.pickRemove) {
        await interaction.reply({
          content: "Tienes varias cuentas apuntadas. Elige cuáles quitar:",
          components: [unpickRow(r.pickRemove.season, id, r.pickRemove.accounts)],
          flags: eph,
        });
        return;
      }
      await interaction.reply({ content: r.text, flags: eph });
      return;
    }
    if (interaction.commandName === "lista-cwl") {
      await interaction.reply(await listReply()); // pública: la ve todo el canal
      return;
    }
    if (interaction.commandName === "help") {
      await interaction.reply({ content: HELP_TEXT, flags: eph });
      return;
    }
  } catch (err) {
    console.error("Error en interacción:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "⚠️ Ha ocurrido un error. Inténtalo de nuevo.", flags: eph }).catch(() => {});
    }
  }
});

// --- Texto libre (canal de inscripciones) ---

client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;

    // DM (sin servidor): flujo de identificación por tag de CoC.
    if (!msg.guild) {
      await handleDm(msg);
      return;
    }

    // DEBUG temporal: ver qué llega (canal, contenido) en los logs de Fly.
    console.log(
      `[msg] ch=${msg.channelId} user=${msg.author.username} content=${JSON.stringify(msg.content)}`,
    );

    if (SIGNUP_CHANNELS.length && !SIGNUP_CHANNELS.includes(msg.channelId)) {
      console.log(`[skip] canal ${msg.channelId} no está en la lista [${SIGNUP_CHANNELS.join(",")}]`);
      return;
    }

    const id = msg.author.id;
    const username = msg.author.username;
    const intent = classifyIntent(msg.content);
    if (intent) console.log(`[intent] ${username} -> ${intent}`);

    if (intent === "help") {
      await msg.reply(HELP_TEXT);
      return;
    }
    if (intent === "list") {
      await msg.reply(await listReply());
      return;
    }
    if (intent === "status") {
      await msg.reply(await doStatus(id));
      return;
    }
    if (intent === "unsignup") {
      const r = await doUnsignup(id);
      if (r.pickRemove) {
        await msg.reply({
          content: "Tienes varias cuentas apuntadas. Elige cuáles quitar:",
          components: [unpickRow(r.pickRemove.season, id, r.pickRemove.accounts)],
        });
      } else if (r.react) {
        await msg.react(r.react).catch(() => {});
      } else if (r.text) {
        await msg.reply(r.text);
      }
      return;
    }
    if (intent === "signup") {
      const r = await doSignup(id, username);
      if (r.pick) {
        await msg.reply({
          content: "Tienes varias cuentas vinculadas. Elige cuáles apuntar a la CWL:",
          components: [pickRow(r.pick.season, id, r.pick.accounts)],
        });
      } else if (r.react) {
        await msg.react(r.react).catch(() => {});
        if (r.text) await msg.reply(r.text); // aviso de cola
      } else if (r.text) {
        await msg.reply(r.text); // cerrada / ya apuntado / sin lista
      }
      return;
    }
  } catch (err) {
    console.error("Error en messageCreate:", err);
  }
});

// --- Bienvenida: al entrar alguien, pedirle el tag por DM (o en el general) ---

const WELCOME_DM =
  "👋 ¡Bienvenido/a a **Añakleta**!\n\n" +
  "Para que sepamos quién eres, pégame aquí tu **tag de Clash of Clans** y te pongo " +
  "tu nombre del juego como apodo del servidor.\n" +
  "-# 📍 Lo tienes en el juego: tu perfil, justo debajo de tu nombre (empieza por `#`, ej. `#2ABC123`).";

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    if (member.user.bot) return;
    const ok = await member.send(WELCOME_DM).then(() => true).catch(() => false);
    if (!ok) {
      // MD cerrados -> saludo en el general etiquetándole.
      const { welcomeChannelId } = await cwl.getConfig(db);
      if (welcomeChannelId) {
        await cwl.postMention(
          welcomeChannelId,
          `👋 ¡Bienvenido <@${member.id}>! Escríbeme por privado tu **tag de Clash of Clans** ` +
            "(ej. `#2ABC123`) para ponerte tu nombre del juego, o pásaselo a un colíder.",
          member.id,
        );
      }
    }
  } catch (err) {
    console.error("Error en GuildMemberAdd:", err);
  }
});

// Identificación por DM: el usuario pega su tag -> ponemos su nombre de CoC como
// apodo y (si es del clan) vinculamos su Discord con esa cuenta.
async function handleDm(msg) {
  const m = msg.content.match(TAG_RE);
  if (!m) {
    // Distinguir "lo intentó con un # inválido" de un mensaje cualquiera.
    const tried = msg.content.includes("#");
    await msg
      .reply(
        tried
          ? "Mmm, ese tag no me cuadra 🤔. Son 8-9 caracteres tras la **#** (solo: `0 2 8 9 P Y L Q G R J C U V`), p. ej. `#2ABC123`."
          : "👋 Pégame tu **tag de Clash of Clans** para identificarte, p. ej. `#2ABC123`.\n-# Lo ves en tu perfil del juego, debajo del nombre.",
      )
      .catch(() => {});
    return;
  }

  await msg.channel.sendTyping().catch(() => {}); // feedback: “escribiendo…”
  const player = await coc.getPlayer(m[1]);
  if (!player || !player.name) {
    await msg
      .reply("No encuentro ninguna cuenta con ese tag 🤔. Míralo bien (que no falte ni sobre un carácter) y vuelve a pegármelo.")
      .catch(() => {});
    return;
  }

  // Miembro del servidor (para apodo y rol de TH).
  let guild = null;
  let member = null;
  try {
    guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    member = await guild.members.fetch(msg.author.id);
  } catch {
    /* no está en el servidor / sin acceso */
  }

  // Apodo = nombre de CoC.
  let nickOk = false;
  if (member) {
    try {
      await member.setNickname(String(player.name).slice(0, 32));
      nickOk = true;
    } catch {
      nickOk = false; // owner / rol más alto / sin permiso Manage Nicknames
    }
  }

  // Vincular con la cuenta del clan (si ese tag es de un miembro).
  let linked = null;
  try {
    linked = await cwl.linkDiscordToMember(db, player.tag, msg.author.id, msg.author.username);
  } catch (err) {
    console.error("[db] linkDiscordToMember:", err?.message ?? err);
  }

  // Rol de TH al momento, solo si es su cuenta PRINCIPAL (como el cron diario).
  let thOk = false;
  if (member && guild && linked && !linked.main_tag) {
    thOk = await syncThRole(guild, member, player.townHallLevel).catch(() => false);
  }

  const thTxt = player.townHallLevel ? `  ·  🏰 TH${player.townHallLevel}` : "";
  const lines = [`✅ ¡Listo, **${player.name}**!${thTxt}`];
  lines.push(
    nickOk
      ? "• Te he puesto ese nombre como **apodo** del servidor."
      : "• No he podido cambiarte el apodo (permisos); cámbialo tú a ese nombre 🙏.",
  );
  if (thOk) lines.push(`• Rol de **TH${player.townHallLevel}** asignado.`);
  if (linked) lines.push("• **Vinculado** con tu cuenta del clan para la CWL. 🎯");
  lines.push("-# Cuando haya Liga de Clanes, entra escribiendo «participo».");
  await msg.reply(lines.join("\n")).catch(() => {});
}

// Pone el rol "TH N" (por nombre) y quita cualquier otro rol de TH que tuviera.
async function syncThRole(guild, member, townHall) {
  if (!townHall) return false;
  const roles = await guild.roles.fetch();
  let desired = null;
  const allTh = [];
  roles.forEach((r) => {
    const mm = r.name.match(/^th\s*(\d{1,2})$/i);
    if (mm) {
      allTh.push(r.id);
      if (Number(mm[1]) === townHall) desired = r;
    }
  });
  if (!desired) return false;
  try {
    if (!member.roles.cache.has(desired.id)) await member.roles.add(desired.id);
    for (const id of allTh) {
      if (id !== desired.id && member.roles.cache.has(id)) await member.roles.remove(id);
    }
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Servidor web: landing del clan + estado del bot (health). Temática CoC.
// Fly enruta HTTP aquí (ver [http_service] en fly.toml). /health devuelve JSON.
// ─────────────────────────────────────────────────────────────────────────────
const WEB_PORT = Number(process.env.PORT) || 8080;
const CLAN_TAG_CLEAN = (process.env.COC_CLAN_TAG ?? "").replace(/^#/, "").toUpperCase();
const JOIN_URL = CLAN_TAG_CLEAN
  ? `https://link.clashofclans.com/es?action=OpenClanProfile&tag=${CLAN_TAG_CLEAN}`
  : null;
const INVITE_URL = process.env.DISCORD_INVITE_URL || "https://discord.gg/p4xKrHEVwa";

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function healthJson() {
  const ready = client.isReady();
  return {
    ok: ready,
    bot: client.user?.tag ?? null,
    status: ready ? "online" : "connecting",
    presence: lastPresenceText,
    uptime_s: Math.floor((Date.now() - BOOT_MS) / 1000),
    ping_ms: Math.max(0, Math.round(client.ws.ping)),
    guilds: client.guilds.cache.size,
    clan: lastClan
      ? { name: lastClan.name, level: lastClan.clanLevel, members: lastClan.members }
      : null,
  };
}

function renderLanding() {
  const ready = client.isReady();
  const botTag = esc(client.user?.tag ?? "Añakleta");
  const ping = Math.max(0, Math.round(client.ws.ping));
  const guilds = client.guilds.cache.size;
  const uptimeS = Math.floor((Date.now() - BOOT_MS) / 1000);
  const c = lastClan;
  const w = lastWar;

  const dot = ready ? "#43b581" : "#faa61a";
  const statusLabel = ready ? "ONLINE" : "CONECTANDO…";

  let warLine = "";
  if (w?.state === "inWar" && w.opponent?.name) {
    warLine = `⚔️ En guerra vs <b>${esc(w.opponent.name)}</b> · ${w.clan?.stars ?? 0}–${w.opponent?.stars ?? 0}⭐`;
  } else if (w?.state === "preparation") {
    warLine = "🛡️ Preparando la próxima guerra";
  } else {
    warLine = "🕊️ Sin guerra ahora mismo";
  }

  const badge = c?.badgeUrls?.large || c?.badgeUrls?.medium || "";
  const clanBlock = c
    ? `
      <div class="clan">
        ${badge ? `<img class="badge" src="${esc(badge)}" alt="Escudo" width="88" height="88">` : "🛡️"}
        <div class="claninfo">
          <div class="clanname">${esc(c.name ?? "Añakleta")}</div>
          <div class="tag">#${esc(CLAN_TAG_CLEAN)}</div>
          <div class="chips">
            <span class="chip">🏰 Nivel ${c.clanLevel ?? "—"}</span>
            <span class="chip">👥 ${c.members ?? "—"}/50</span>
            <span class="chip">🏆 ${(c.clanPoints ?? 0).toLocaleString("es-ES")}</span>
            ${c.warLeague?.name ? `<span class="chip">⚔️ ${esc(c.warLeague.name)}</span>` : ""}
            ${c.warWinStreak ? `<span class="chip">🔥 Racha ${c.warWinStreak}</span>` : ""}
          </div>
        </div>
      </div>`
    : `<div class="clan"><div class="claninfo"><div class="clanname">Añakleta</div><div class="tag">cargando datos del clan…</div></div></div>`;

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Añakleta · Bot del clan</title>
<style>
  :root{ --gold:#f5c451; --gold2:#e0a53a; --green:#6fbf5b; --ink:#f4ece0; --soft:#c9bda8; --line:#3a3327; }
  *{ box-sizing:border-box; }
  body{ margin:0; min-height:100vh; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        color:var(--ink); background:
          radial-gradient(1200px 500px at 50% -10%, #2b3d1e 0%, transparent 60%),
          linear-gradient(160deg,#1a2416 0%,#141109 55%,#0f0c07 100%);
        display:flex; align-items:center; justify-content:center; padding:22px; }
  .card{ width:100%; max-width:560px; background:rgba(24,20,13,.86); border:1px solid var(--line);
         border-radius:22px; padding:22px; box-shadow:0 20px 60px rgba(0,0,0,.5); }
  .top{ display:flex; align-items:center; gap:12px; margin-bottom:6px; }
  .bot{ font-size:34px; }
  h1{ margin:0; font-size:30px; letter-spacing:1px; color:var(--gold);
      text-shadow:0 2px 0 #7a5b12; }
  .sub{ color:var(--soft); font-weight:700; font-size:13px; letter-spacing:.5px; }
  .status{ display:inline-flex; align-items:center; gap:8px; margin:14px 0 4px; padding:7px 14px;
           background:rgba(67,181,129,.12); border:1px solid rgba(67,181,129,.35); border-radius:999px;
           font-weight:800; font-size:13px; letter-spacing:1px; }
  .pdot{ width:11px; height:11px; border-radius:50%; background:${dot}; box-shadow:0 0 0 0 ${dot};
         animation:pulse 1.8s infinite; }
  @keyframes pulse{ 0%{box-shadow:0 0 0 0 ${dot}88} 70%{box-shadow:0 0 0 9px ${dot}00} 100%{box-shadow:0 0 0 0 ${dot}00} }
  .presence{ color:var(--soft); font-size:13px; margin:2px 0 14px; }
  .grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
  .stat{ background:rgba(0,0,0,.28); border:1px solid var(--line); border-radius:14px; padding:12px; text-align:center; }
  .stat .n{ font-size:20px; font-weight:900; color:var(--gold); }
  .stat .l{ font-size:10px; letter-spacing:.6px; color:var(--soft); text-transform:uppercase; font-weight:800; }
  .war{ text-align:center; background:rgba(0,0,0,.22); border:1px dashed var(--line); border-radius:14px;
        padding:12px; margin-bottom:16px; font-size:14px; }
  .clan{ display:flex; align-items:center; gap:14px; background:rgba(111,191,91,.08);
         border:1px solid rgba(111,191,91,.25); border-radius:16px; padding:14px; margin-bottom:16px; }
  .badge{ border-radius:10px; }
  .clanname{ font-size:20px; font-weight:900; color:var(--ink); }
  .tag{ color:var(--soft); font-size:12px; font-weight:700; margin-bottom:6px; }
  .chips{ display:flex; flex-wrap:wrap; gap:6px; }
  .chip{ background:rgba(0,0,0,.3); border:1px solid var(--line); border-radius:999px; padding:3px 9px;
         font-size:12px; font-weight:700; color:var(--ink); }
  .cta{ display:flex; flex-wrap:wrap; gap:10px; }
  .btn{ flex:1 1 200px; text-align:center; text-decoration:none; font-weight:900; padding:13px 16px;
        border-radius:14px; font-size:14px; }
  .btn.gold{ background:linear-gradient(180deg,var(--gold),var(--gold2)); color:#3a2410; }
  .btn.disc{ background:#5865F2; color:#fff; }
  .foot{ text-align:center; color:var(--soft); font-size:11px; margin-top:16px; }
</style></head>
<body>
  <div class="card">
    <div class="top">
      <div class="bot">🤖</div>
      <div>
        <h1>AÑAKLETA</h1>
        <div class="sub">BOT DE DISCORD · TU ALIADO 24/7</div>
      </div>
    </div>

    <div class="status"><span class="pdot"></span> ${statusLabel}</div>
    <div class="presence">${esc(lastPresenceText)}</div>

    <div class="grid">
      <div class="stat"><div class="n" id="uptime">—</div><div class="l">Encendido</div></div>
      <div class="stat"><div class="n">${ping}<span style="font-size:12px">ms</span></div><div class="l">Latencia</div></div>
      <div class="stat"><div class="n">${guilds}</div><div class="l">Servidores</div></div>
    </div>

    <div class="war">${warLine}</div>

    ${clanBlock}

    <div class="cta">
      ${JOIN_URL ? `<a class="btn gold" href="${esc(JOIN_URL)}">⚔️ Unirse al clan</a>` : ""}
      ${INVITE_URL ? `<a class="btn disc" href="${esc(INVITE_URL)}">💬 Entrar al Discord</a>` : ""}
    </div>

    <div class="foot">Hecho con ⚔️ para el clan · ${botTag}</div>
  </div>
<script>
  var boot = ${uptimeS};
  function fmt(s){ var d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;
    return (d? d+"d ":"")+(h? h+"h ":"")+(d?"":m+"m ")+(d||h?"":x+"s"); }
  var el=document.getElementById("uptime");
  setInterval(function(){ boot++; el.textContent=fmt(boot); },1000);
  el.textContent=fmt(boot);
</script>
</body></html>`;
}

const web = http.createServer((req, res) => {
  const path = (req.url || "/").split("?")[0];
  if (path === "/health" || path === "/healthz") {
    // 200 mientras el proceso viva (discord.js reconecta solo); el estado real de
    // Discord va en el JSON. Evita reinicios de Fly por reconexiones puntuales.
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(healthJson()));
    return;
  }
  if (path === "/" ) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderLanding());
    return;
  }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("No encontrado");
});
web.listen(WEB_PORT, () => console.log(`Landing/health en :${WEB_PORT}`));

client.login(DISCORD_BOT_TOKEN);
