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
} from "discord.js";
import { createClient } from "@supabase/supabase-js";
import { classifyIntent } from "./match.js";
import * as cwl from "./cwl.js";

// Súbelo cuando cambies algo. En `fly logs` verás esta línea al arrancar: si NO
// cambia tras un deploy, es que el deploy no ha subido el código nuevo.
const BOT_VERSION = "v9 secundaria-relativa";

// Texto de ayuda, compartido por «¿cómo me apunto?» (texto libre) y /help.
const HELP_TEXT =
  "ℹ️ **Cómo funciona la CWL por aquí:**\n" +
  "• Para **apuntarte**, escribe «me apunto» (o usa `/apuntar`) y reaccionaré con ✅.\n" +
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privilegiado: activar en el portal
  ],
  partials: [Partials.Channel],
});

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
  if (!list || !(await cwl.isSignedUp(db, list.season, id))) {
    return { text: "ℹ️ No estabas apuntado a la CWL." };
  }
  await cwl.removeSignup(db, list.season, id);
  await cwl.removeRole(db, id);
  await cwl.refreshLiveList(db, list.season);
  return { react: "👋", text: "👋 Te he quitado de la CWL." };
}

async function doStatus(id) {
  const list = await cwl.getActiveList(db);
  const yes = list && (await cwl.isSignedUp(db, list.season, id));
  return yes
    ? "✅ Sí, estás apuntado a la CWL. Consulta la lista con `/lista-cwl`."
    : "❌ No estás apuntado. Escribe «me apunto» o usa `/apuntar`.";
}

// --- Slash commands ---

const COMMANDS = [
  { name: "apuntar", description: "Apuntarte a la Liga de Clanes (CWL)" },
  { name: "desapuntar", description: "Salir de la Liga de Clanes (CWL)" },
  { name: "lista-cwl", description: "Ver la lista de inscritos a la CWL" },
  { name: "help", description: "Cómo funciona la inscripción a la CWL" },
];

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot conectado como ${c.user.tag} — ${BOT_VERSION}`);
  console.log(`DISCORD_GUILD_ID=${DISCORD_GUILD_ID ?? "(sin definir)"}`);
  try {
    const set = DISCORD_GUILD_ID
      ? await c.application.commands.set(COMMANDS, DISCORD_GUILD_ID) // instantáneo
      : await c.application.commands.set(COMMANDS); // global (tarda ~1h en propagar)
    const names = set.map((cmd) => `/${cmd.name}`).join(", ");
    console.log(
      DISCORD_GUILD_ID
        ? `Slash commands registrados en el servidor ${DISCORD_GUILD_ID}: ${names}`
        : `Slash commands registrados globalmente (tardan ~1h): ${names}`,
    );
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
      if (r.react) await msg.react(r.react).catch(() => {});
      else if (r.text) await msg.reply(r.text);
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

client.login(DISCORD_BOT_TOKEN);
