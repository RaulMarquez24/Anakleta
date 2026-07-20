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
let botAvatarUrl = null; // logo del bot (avatar)
let botBannerUrl = null; // banner del perfil del bot

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
  // Logo (avatar) y banner del bot para la landing.
  try {
    botAvatarUrl = c.user.displayAvatarURL({ size: 256, extension: "png" });
    const full = await c.user.fetch(); // fuerza a poblar el banner
    botBannerUrl = full.bannerURL?.({ size: 1024, extension: "png" }) ?? null;
  } catch (err) {
    console.error("[assets]", err?.message ?? err);
  }
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
  let warTone = "calm";
  if (w?.state === "inWar" && w.opponent?.name) {
    warLine = `⚔️ En guerra vs <b>${esc(w.opponent.name)}</b> · ${w.clan?.stars ?? 0}–${w.opponent?.stars ?? 0} ⭐`;
    warTone = "hot";
  } else if (w?.state === "preparation") {
    warLine = "🛡️ Preparando la próxima guerra";
    warTone = "prep";
  } else {
    warLine = "🕊️ Sin guerra ahora mismo";
  }

  const badge = c?.badgeUrls?.large || c?.badgeUrls?.medium || "";
  const clanBlock = c
    ? `
      <div class="clan">
        ${badge ? `<img class="badge" src="${esc(badge)}" alt="Escudo" width="92" height="92">` : `<div class="badge badge-emoji">🛡️</div>`}
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

  const logoHtml = botAvatarUrl
    ? `<img class="logo" src="${esc(botAvatarUrl)}" alt="Logo">`
    : `<div class="logo logo-emoji">🤖</div>`;
  const bannerHtml = botBannerUrl ? `<img class="banner" src="${esc(botBannerUrl)}" alt="Banner Añakleta">` : "";

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Añakleta · Bot del clan</title>
<style>
  :root{ --gold:#f5c451; --gold2:#e0a53a; --green:#6fbf5b; --ink:#f6ecd9; --soft:#c9bda8; --line:#4a4130; --disc:#5865F2; }
  *{ box-sizing:border-box; }
  html,body{ margin:0; }
  body{ min-height:100vh; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--ink);
        background:linear-gradient(-45deg,#0e1b0a,#15220d,#1c1708,#100c07); background-size:400% 400%;
        animation:bg 20s ease infinite; overflow-x:hidden; display:flex; align-items:center; justify-content:center; padding:24px; }
  @keyframes bg{ 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  .sky{ position:fixed; inset:0; pointer-events:none; overflow:hidden; z-index:0; }
  .sky span{ position:absolute; bottom:-40px; font-size:22px; opacity:0; animation:rise linear infinite; filter:drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
  @keyframes rise{ 0%{ transform:translateY(0) rotate(0); opacity:0 } 10%{opacity:.5} 90%{opacity:.5} 100%{ transform:translateY(-112vh) rotate(320deg); opacity:0 } }
  .sky span:nth-child(1){ left:8%; animation-duration:16s }
  .sky span:nth-child(2){ left:24%; animation-duration:22s; animation-delay:3s; font-size:16px }
  .sky span:nth-child(3){ left:42%; animation-duration:19s; animation-delay:6s }
  .sky span:nth-child(4){ left:60%; animation-duration:25s; animation-delay:1s; font-size:18px }
  .sky span:nth-child(5){ left:76%; animation-duration:17s; animation-delay:8s }
  .sky span:nth-child(6){ left:90%; animation-duration:23s; animation-delay:4s; font-size:14px }

  .card{ position:relative; z-index:1; width:100%; max-width:620px; background:rgba(22,18,11,.9);
         border:1px solid var(--line); border-radius:26px; overflow:hidden;
         box-shadow:0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05); animation:pop .5s ease both; }

  .hero{ position:relative; height:180px; background:linear-gradient(160deg,#4a86c7,#7fb0dd 40%,#2b3d1e); overflow:hidden; }
  .banner{ width:100%; height:100%; object-fit:cover; display:block; animation:kb 22s ease-in-out infinite alternate; }
  @keyframes kb{ 0%{ transform:scale(1) } 100%{ transform:scale(1.08) } }
  .hero-ov{ position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(22,18,11,.96)); }
  .ring{ position:absolute; left:50%; bottom:-44px; width:116px; height:116px; transform:translateX(-50%);
         border-radius:50%; border:2px dashed rgba(245,196,81,.5); animation:spin 12s linear infinite; z-index:1; }
  @keyframes spin{ to{ transform:translateX(-50%) rotate(360deg) } }
  .logo-wrap{ position:absolute; left:50%; bottom:-44px; transform:translateX(-50%); z-index:2; }
  .logo{ width:100px; height:100px; border-radius:50%; object-fit:cover; display:block;
         border:4px solid var(--gold); box-shadow:0 0 0 4px #16120b, 0 8px 24px rgba(0,0,0,.5); animation:bob 4s ease-in-out infinite; }
  .logo-emoji{ display:flex; align-items:center; justify-content:center; font-size:50px; background:#16120b; }
  @keyframes bob{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-6px) } }

  .body{ padding:62px 24px 24px; text-align:center; }
  h1{ margin:0; font-size:42px; font-weight:900; letter-spacing:2px; line-height:1;
      background:linear-gradient(90deg,#f7d97a,#f5c451,#fff2c8,#f5c451,#e0a53a); background-size:200% auto;
      -webkit-background-clip:text; background-clip:text; color:transparent; animation:shimmer 4s linear infinite;
      filter:drop-shadow(0 3px 0 rgba(122,91,18,.35)); }
  @keyframes shimmer{ to{ background-position:200% center } }
  .sub{ color:var(--soft); font-weight:800; font-size:12px; letter-spacing:2px; margin-top:8px; }

  .status{ display:inline-flex; align-items:center; gap:9px; margin:16px 0 6px; padding:8px 16px;
           background:rgba(67,181,129,.14); border:1px solid rgba(67,181,129,.4); border-radius:999px;
           font-weight:900; font-size:12px; letter-spacing:1.5px; }
  .pdot{ width:11px; height:11px; border-radius:50%; background:${dot}; animation:pulse 1.8s infinite; }
  @keyframes pulse{ 0%{box-shadow:0 0 0 0 ${dot}aa} 70%{box-shadow:0 0 0 10px ${dot}00} 100%{box-shadow:0 0 0 0 ${dot}00} }
  .presence{ color:var(--soft); font-size:13px; margin-bottom:18px; }

  .grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:16px; }
  .stat{ background:rgba(0,0,0,.32); border:1px solid var(--line); border-radius:16px; padding:14px 8px; transition:transform .2s, border-color .2s; }
  .stat:hover{ transform:translateY(-4px); border-color:var(--gold); }
  .stat .n{ font-size:24px; font-weight:900; color:var(--gold); }
  .stat .n span{ font-size:12px; }
  .stat .l{ font-size:10px; letter-spacing:.6px; color:var(--soft); text-transform:uppercase; font-weight:800; margin-top:2px; }

  .war{ border-radius:16px; padding:14px; margin-bottom:16px; font-size:14px; font-weight:600;
        background:rgba(0,0,0,.28); border:1px solid var(--line); }
  .war.hot{ border-color:rgba(213,87,59,.6); animation:glow 2.2s ease-in-out infinite; }
  @keyframes glow{ 0%,100%{ box-shadow:0 0 0 0 rgba(213,87,59,0) } 50%{ box-shadow:0 0 22px 0 rgba(213,87,59,.35) } }

  .clan{ display:flex; align-items:center; gap:16px; text-align:left; background:rgba(111,191,91,.09);
         border:1px solid rgba(111,191,91,.28); border-radius:18px; padding:16px; margin-bottom:18px; }
  .badge{ border-radius:12px; flex:none; }
  .badge-emoji{ width:92px; height:92px; display:flex; align-items:center; justify-content:center; font-size:52px; }
  .clanname{ font-size:22px; font-weight:900; }
  .tag{ color:var(--soft); font-size:12px; font-weight:800; margin:2px 0 8px; letter-spacing:.5px; }
  .chips{ display:flex; flex-wrap:wrap; gap:6px; }
  .chip{ background:rgba(0,0,0,.34); border:1px solid var(--line); border-radius:999px; padding:4px 10px; font-size:12px; font-weight:800; }

  .cta{ display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
  .btn{ position:relative; overflow:hidden; flex:1 1 200px; text-align:center; text-decoration:none; font-weight:900;
        padding:15px 16px; border-radius:16px; font-size:15px; transition:transform .15s, filter .15s; }
  .btn:hover{ transform:translateY(-2px); filter:brightness(1.06); }
  .btn::before{ content:""; position:absolute; top:0; left:-120%; width:60%; height:100%;
                background:linear-gradient(120deg,transparent,rgba(255,255,255,.45),transparent); transform:skewX(-20deg); animation:shine 3.4s infinite; }
  @keyframes shine{ 0%{left:-120%} 55%{left:130%} 100%{left:130%} }
  .btn.gold{ background:linear-gradient(180deg,var(--gold),var(--gold2)); color:#3a2410; box-shadow:0 8px 20px rgba(245,196,81,.25); }
  .btn.disc{ background:var(--disc); color:#fff; box-shadow:0 8px 20px rgba(88,101,242,.3); }

  .feats{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  .feat{ background:rgba(0,0,0,.28); border:1px solid var(--line); border-radius:14px; padding:10px 6px; font-size:10px; font-weight:800; color:var(--soft); text-transform:uppercase; letter-spacing:.4px; }
  .feat b{ display:block; font-size:20px; margin-bottom:3px; }

  .foot{ text-align:center; color:var(--soft); font-size:11px; margin-top:16px; }

  .reveal{ animation:pop .6s ease both; }
  .d1{ animation-delay:.05s } .d2{ animation-delay:.15s } .d3{ animation-delay:.25s } .d4{ animation-delay:.35s } .d5{ animation-delay:.45s }
  @keyframes pop{ from{ opacity:0; transform:translateY(14px) } to{ opacity:1; transform:none } }
  @media (max-width:460px){ .feats{ grid-template-columns:repeat(2,1fr) } h1{ font-size:34px } }
</style></head>
<body>
  <div class="sky"><span>⚔️</span><span>🛡️</span><span>⭐</span><span>👑</span><span>🏆</span><span>🔥</span></div>
  <div class="card">
    <div class="hero">
      ${bannerHtml}
      <div class="hero-ov"></div>
      <div class="ring"></div>
      <div class="logo-wrap">${logoHtml}</div>
    </div>
    <div class="body">
      <h1>AÑAKLETA</h1>
      <div class="sub">BOT DE DISCORD · TU ALIADO 24/7</div>

      <div><span class="status"><span class="pdot"></span> ${statusLabel}</span></div>
      <div class="presence">${esc(lastPresenceText)}</div>

      <div class="grid reveal d1">
        <div class="stat"><div class="n" id="uptime">—</div><div class="l">Encendido</div></div>
        <div class="stat"><div class="n"><span data-count="${ping}">0</span><span>ms</span></div><div class="l">Latencia</div></div>
        <div class="stat"><div class="n" data-count="${guilds}">0</div><div class="l">Servidores</div></div>
      </div>

      <div class="war ${warTone} reveal d2">${warLine}</div>

      <div class="reveal d3">${clanBlock}</div>

      <div class="cta reveal d4">
        ${JOIN_URL ? `<a class="btn gold" href="${esc(JOIN_URL)}">⚔️ Unirse al clan</a>` : ""}
        ${INVITE_URL ? `<a class="btn disc" href="${esc(INVITE_URL)}">💬 Entrar al Discord</a>` : ""}
      </div>

      <div class="feats reveal d5">
        <div class="feat"><b>🛡️</b>Bienvenidas</div>
        <div class="feat"><b>⚔️</b>Guerras</div>
        <div class="feat"><b>🏆</b>Ranking</div>
        <div class="feat"><b>📅</b>Eventos</div>
      </div>

      <div class="foot">Hecho con ⚔️ para el clan · ${botTag}</div>
    </div>
  </div>
<script>
  var boot = ${uptimeS};
  function fmt(s){ var d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;
    return (d? d+"d ":"")+(h? h+"h ":"")+(d?"":m+"m ")+(d||h?"":x+"s"); }
  var el=document.getElementById("uptime");
  function tick(){ el.textContent=fmt(boot); boot++; }
  tick(); setInterval(tick,1000);
  document.querySelectorAll("[data-count]").forEach(function(n){
    var end=parseInt(n.getAttribute("data-count"),10)||0, cur=0, step=Math.max(1,Math.round(end/40));
    var t=setInterval(function(){ cur+=step; if(cur>=end){cur=end; clearInterval(t);} n.textContent=cur; },28);
  });
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
