// Bot de Discord del clan Añakleta. Proceso 24/7 (Fly.io) conectado al gateway.
// Comparte la BD de Supabase con la app (misma service key).
//
// Funciones iniciales (inscripción a la CWL):
//  - En el canal de inscripciones, si alguien escribe "me apunto" (y variantes),
//    lo registra en cwl_signups y reacciona ✅.
//  - "me desapunto" / "me borro" -> lo quita y reacciona 👋.
//  - "¿estoy apuntado?" -> responde Sí/No.

import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { createClient } from "@supabase/supabase-js";
import { classifyIntent } from "./match.js";

const {
  DISCORD_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  SIGNUP_CHANNEL_ID, // opcional: uno o varios canales (separados por comas)
} = process.env;

// Lista de canales donde escuchar. Vacío = todos los canales.
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

async function isSignedUp(id) {
  const { data } = await db.from("cwl_signups").select("discord_id").eq("discord_id", id).maybeSingle();
  return Boolean(data);
}

client.once(Events.ClientReady, (c) => {
  console.log(`Bot conectado como ${c.user.tag}`);
});

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
          "• Para **apuntarte**, escribe «me apunto» y reaccionaré con ✅.\n" +
          "• Para **comprobar** si estás, escribe «¿estoy apuntado?».\n" +
          "• Para **salir**, escribe «me desapunto».",
      );
      return;
    }

    if (intent === "status") {
      const yes = await isSignedUp(id);
      await msg.reply(yes ? "✅ Sí, estás apuntado a la CWL." : "❌ No estás apuntado. Escribe «me apunto».");
      return;
    }

    if (intent === "unsignup") {
      await db.from("cwl_signups").delete().eq("discord_id", id);
      await msg.react("👋").catch(() => {});
      return;
    }

    if (intent === "signup") {
      await db
        .from("cwl_signups")
        .upsert(
          { discord_id: id, username, created_at: new Date().toISOString() },
          { onConflict: "discord_id" },
        );
      await msg.react("✅").catch(() => {});
      return;
    }
  } catch (err) {
    console.error("Error en messageCreate:", err);
  }
});

client.login(DISCORD_BOT_TOKEN);
