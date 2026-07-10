// Bot de Discord del clan Añakleta. Proceso 24/7 (Fly.io) conectado al gateway.
// Comparte la BD de Supabase con la app (misma service key).
//
// Inscripción a la CWL, de dos formas:
//  1) Texto libre en el canal de inscripciones ("me apunto", "me desapunto",
//     "¿estoy apuntado?", "¿cómo me apunto?") -> detección tolerante a erratas.
//  2) Slash commands (en cualquier canal): /apuntar, /desapuntar, /lista-cwl.

import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  MessageFlags,
} from "discord.js";
import { createClient } from "@supabase/supabase-js";
import { classifyIntent } from "./match.js";

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

// --- Acceso a datos (cwl_signups) ---

async function isSignedUp(id) {
  const { data } = await db.from("cwl_signups").select("discord_id").eq("discord_id", id).maybeSingle();
  return Boolean(data);
}

async function signUp(id, username) {
  await db
    .from("cwl_signups")
    .upsert(
      { discord_id: id, username, created_at: new Date().toISOString() },
      { onConflict: "discord_id" },
    );
}

async function signOut(id) {
  await db.from("cwl_signups").delete().eq("discord_id", id);
}

async function getSignups() {
  const { data } = await db
    .from("cwl_signups")
    .select("username, created_at")
    .order("created_at", { ascending: true });
  return data ?? [];
}

function formatList(rows) {
  if (!rows.length) return "📋 **CWL** — todavía no hay nadie apuntado.";
  const lines = rows.map((r, i) => `\`${String(i + 1).padStart(2, " ")}.\` ${r.username}`);
  return `📋 **Inscritos a la CWL (${rows.length}):**\n${lines.join("\n")}`;
}

// --- Slash commands ---

const COMMANDS = [
  { name: "apuntar", description: "Apuntarte a la Liga de Clanes (CWL)" },
  { name: "desapuntar", description: "Salir de la Liga de Clanes (CWL)" },
  { name: "lista-cwl", description: "Ver la lista de inscritos a la CWL" },
];

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot conectado como ${c.user.tag}`);
  try {
    if (DISCORD_GUILD_ID) {
      await c.application.commands.set(COMMANDS, DISCORD_GUILD_ID); // instantáneo
      console.log(`Slash commands registrados en el servidor ${DISCORD_GUILD_ID}`);
    } else {
      await c.application.commands.set(COMMANDS); // global (tarda ~1h en propagar)
      console.log("Slash commands registrados globalmente (pueden tardar ~1h)");
    }
  } catch (err) {
    console.error("No se pudieron registrar los slash commands:", err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const id = interaction.user.id;
  const username = interaction.user.username;
  try {
    if (interaction.commandName === "apuntar") {
      if (await isSignedUp(id)) {
        await interaction.reply({
          content: "☑️ Ya estabas apuntado a la CWL. Consulta la lista con `/lista-cwl`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await signUp(id, username);
      await interaction.reply({
        content: "✅ ¡Apuntado a la CWL! Para salir usa `/desapuntar`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.commandName === "desapuntar") {
      if (!(await isSignedUp(id))) {
        await interaction.reply({
          content: "ℹ️ No estabas apuntado a la CWL.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await signOut(id);
      await interaction.reply({
        content: "👋 Te he quitado de la CWL. Si cambias de idea, usa `/apuntar`.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (interaction.commandName === "lista-cwl") {
      const rows = await getSignups();
      await interaction.reply(formatList(rows)); // pública: la ve todo el canal
      return;
    }
  } catch (err) {
    console.error("Error en interacción:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "⚠️ Ha ocurrido un error. Inténtalo de nuevo.", flags: MessageFlags.Ephemeral })
        .catch(() => {});
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
      await msg.reply(
        "ℹ️ **Cómo funciona la CWL por aquí:**\n" +
          "• Para **apuntarte**, escribe «me apunto» (o usa `/apuntar`) y reaccionaré con ✅.\n" +
          "• Para **comprobar** si estás, escribe «¿estoy apuntado?» o mira `/lista-cwl`.\n" +
          "• Para **salir**, escribe «me desapunto» (o usa `/desapuntar`).",
      );
      return;
    }

    if (intent === "status") {
      const yes = await isSignedUp(id);
      await msg.reply(
        yes
          ? "✅ Sí, estás apuntado a la CWL. Consulta la lista con `/lista-cwl`."
          : "❌ No estás apuntado. Escribe «me apunto» o usa `/apuntar`.",
      );
      return;
    }

    if (intent === "unsignup") {
      await signOut(id);
      await msg.react("👋").catch(() => {});
      return;
    }

    if (intent === "signup") {
      if (await isSignedUp(id)) {
        await msg.reply("☑️ Ya estás apuntado a la CWL. Consulta la lista con `/lista-cwl`.");
        return;
      }
      await signUp(id, username);
      await msg.react("✅").catch(() => {});
      return;
    }
  } catch (err) {
    console.error("Error en messageCreate:", err);
  }
});

client.login(DISCORD_BOT_TOKEN);
