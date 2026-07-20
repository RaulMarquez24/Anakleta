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

// --- Estado dinámico (lo que se ve bajo el nombre del bot) ---
// En guerra: "⚔️ En guerra vs X". Preparación: "🛡️ Preparando guerra".
// Si no: "👀 Añakleta · N/50". Se refresca solo cada pocos minutos.
async function updatePresence(c) {
  try {
    const [war, clan] = await Promise.all([
      coc.getCurrentWar().catch(() => null),
      coc.getClan().catch(() => null),
    ]);
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

client.login(DISCORD_BOT_TOKEN);
