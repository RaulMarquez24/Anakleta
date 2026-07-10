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

const {
  DISCORD_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  SIGNUP_CHANNEL_ID, // opcional: si se define, solo escucha ese canal
} = process.env;

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

// minúsculas y sin tildes, para matchear frases de forma flexible.
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const RE_SIGNUP = /(me apunto|apuntame|apuntarme|me uno|quiero (jugar|cwl)|voy a la cwl|apuntad[oa] cwl|\+1)/;
const RE_UNSIGNUP = /(me desapunto|desapuntame|me borro|me salgo|quitame)/;
const RE_STATUS = /(estoy apuntad|apuntad[oa]\?|estoy en la lista|estoy dentro)/;

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
    if (SIGNUP_CHANNEL_ID && msg.channelId !== SIGNUP_CHANNEL_ID) return;

    const text = norm(msg.content);
    const id = msg.author.id;
    const username = msg.author.username;

    if (RE_STATUS.test(text)) {
      const yes = await isSignedUp(id);
      await msg.reply(yes ? "✅ Sí, estás apuntado a la CWL." : "❌ No estás apuntado. Escribe «me apunto».");
      return;
    }

    if (RE_UNSIGNUP.test(text)) {
      await db.from("cwl_signups").delete().eq("discord_id", id);
      await msg.react("👋").catch(() => {});
      return;
    }

    if (RE_SIGNUP.test(text)) {
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
