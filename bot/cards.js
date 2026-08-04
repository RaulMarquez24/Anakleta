// Intercambio de cartas del evento (Clashiversario). Cada jugador marca las
// cartas que le SOBRAN (repetidas) desde menús desplegables y el bot mantiene un
// tablón agrupado por carta: se ve de un vistazo a quién pedirle la que falta.
// El intercambio en sí se hace dentro del juego; esto solo hace de casamentero.

const API = "https://discord.com/api/v10";
const TOKEN = process.env.DISCORD_BOT_TOKEN;

// Las 4 categorías del álbum (cada una cabe en un menú de Discord: máx. 25).
export const CATEGORIES = [
  {
    key: "elixir",
    label: "Elixir",
    emoji: "⚗️",
    cards: [
      "Bárbaro",
      "Arquera",
      "Gigante",
      "Duende",
      "Rompemuros",
      "Globo",
      "Mago",
      "Curandera",
      "Dragón",
      "P.E.K.K.A",
      "Bebé Dragón",
      "Minero",
      "Dragón Eléctrico",
      "Yeti",
      "Montadragones",
      "Titánide Eléctrica",
      "Druida Salvaje",
      "Lancero",
      "Gólem Meteórico",
    ],
  },
  {
    key: "oscuro",
    label: "Elixir Oscuro",
    emoji: "🖤",
    cards: [
      "Esbirro",
      "Montapuercos",
      "Valquiria",
      "Gólem",
      "Bruja",
      "Sabueso de Lava",
      "Lanzarrocas",
      "Gólem de Hielo",
      "Cazadora de Héroes",
      "Centinela Aprendiz",
      "Druida",
      "Horno",
      "Bruja Caída",
    ],
  },
  {
    key: "constructor",
    label: "Base del Constructor",
    emoji: "🔨",
    cards: [
      "Bárbaro Enfurecido",
      "Arquera Furtiva",
      "Gigante Boxeador",
      "Esbirro Beta",
      "Bombardero",
      "Bebé Dragón (constructor)",
      "Cañón con Ruedas",
      "Bruja Nocturna",
      "Globo Esquelético",
      "P.E.K.K.A Potenciada",
      "Aeropuerco",
    ],
  },
  {
    key: "super",
    label: "Supertropas",
    emoji: "⭐",
    cards: [
      "Súper Bárbaro",
      "Súper Arquera",
      "Súper Gigante",
      "Duende Furtivo",
      "Súper Rompemuros",
      "Globo Cohete",
      "Súper Mago",
      "Súper Dragón",
      "Dragón Infernal",
      "Súper Minero",
      "Súper Yeti",
      "Súper Esbirro",
      "Súper Montapuercos",
      "Súper Valquiria",
      "Súper Bruja",
      "Sabueso de Hielo",
      "Súper Lanzarrocas",
    ],
  },
];

export const ALL_CARDS = CATEGORIES.flatMap((c) => c.cards);
export const categoryOf = (key) => CATEGORIES.find((c) => c.key === key) ?? null;
// El juego solo permite cambiar una carta por otra de la MISMA sección, así que
// hay que saber a qué categoría pertenece cada una.
export const categoryOfCard = (card) => CATEGORIES.find((c) => c.cards.includes(card)) ?? null;
export const sameCategory = (a, b) => {
  const ca = categoryOfCard(a);
  const cb = categoryOfCard(b);
  return ca != null && cb != null && ca.key === cb.key;
};

// --- Config ---
export async function getConfig(db) {
  const { data } = await db
    .from("settings")
    .select("key, value")
    .in("key", [
      "cards_enabled",
      "cards_channel_id",
      "cards_message_id",
      "cards_help_message_id",
    ]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  return {
    enabled: map.get("cards_enabled") === "1",
    channelId: map.get("cards_channel_id") || null,
    messageId: map.get("cards_message_id") || null,
    helpMessageId: map.get("cards_help_message_id") || null,
  };
}

async function setSetting(db, key, value) {
  await db.from("settings").upsert({ key, value }, { onConflict: "key" });
}

// --- Datos ---

// Todas las ofertas (cartas repetidas publicadas), por carta.
export async function getOffers(db) {
  const { data } = await db
    .from("card_offers")
    .select("discord_id, username, card")
    .limit(5000);
  return data ?? [];
}

// Cartas que ya tiene marcadas un usuario.
export async function getMyCards(db, discordId) {
  const { data } = await db.from("card_offers").select("card").eq("discord_id", discordId);
  return new Set((data ?? []).map((r) => r.card));
}

// Guarda la selección de UNA categoría: añade las marcadas y quita las que se
// hayan desmarcado (solo dentro de esa categoría, sin tocar las demás).
export async function setCategory(db, discordId, username, categoryKey, cards) {
  const cat = categoryOf(categoryKey);
  if (!cat) return;
  const chosen = cards.filter((c) => cat.cards.includes(c));
  const quitar = cat.cards.filter((c) => !chosen.includes(c));

  if (quitar.length > 0) {
    await db.from("card_offers").delete().eq("discord_id", discordId).in("card", quitar);
  }
  if (chosen.length > 0) {
    await db.from("card_offers").upsert(
      chosen.map((card) => ({ discord_id: discordId, username, card })),
      { onConflict: "discord_id,card" },
    );
  }
}

// Quita todas las cartas de un usuario (ya las cambió todas).
export async function clearMine(db, discordId) {
  await db.from("card_offers").delete().eq("discord_id", discordId);
}

// --- Tablón ---

// Texto del tablón: agrupado por categoría y carta, con quién la ofrece.
export function renderBoard(offers) {
  // Se muestra el NOMBRE en texto, no la mención: el tablón se publica sin
  // menciones (para no avisar a nadie al reeditarlo) y entonces Discord no manda
  // los datos de esos usuarios, así que los clientes que no los tienen en caché
  // los pintaban como "usuario-desconocido".
  const byCard = new Map();
  for (const o of offers) {
    if (!byCard.has(o.card)) byCard.set(o.card, []);
    byCard.get(o.card).push(o.username || `id:${o.discord_id}`);
  }

  const L = [
    DIV,
    "🃏 **CARTAS REPETIDAS DEL CLAN**",
    "_Quien aparece junto a una carta la tiene repetida: pídesela con_ `/cambiar`_._",
    "",
  ];
  if (byCard.size === 0) {
    L.push("Todavía no hay cartas publicadas. Usa `/repetidas` para poner las tuyas.");
  } else {
    for (const cat of CATEGORIES) {
      const lineas = cat.cards
        .filter((c) => byCard.has(c))
        .map((c) => `• **${c}** → ${byCard.get(c).join(", ")}`);
      if (lineas.length === 0) continue;
      L.push(`${cat.emoji} **${cat.label}**`);
      L.push(...lineas);
      L.push("");
    }
  }
  L.push("_Marca o quita las tuyas con_ `/repetidas`_._");
  L.push(DIV);
  return L.join("\n").slice(0, 3900);
}

// `everyone`: permite la mención de verdad (sale resaltada y avisa). Se usa solo
// en el manual; el tablón se edita muchas veces y nunca menciona a nadie.
async function postMessage(channelId, content, opts = {}) {
  if (!TOKEN || !channelId) return null;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: opts.everyone ? ["everyone"] : [] },
      }),
    });
    if (!res.ok) return null;
    const msg = await res.json();
    return msg.id ?? null;
  } catch {
    return null;
  }
}

async function editMessage(channelId, messageId, content, opts = {}) {
  if (!TOKEN || !channelId || !messageId) return false;
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages/${messageId}`, {
      method: "PATCH",
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        // Al editar, Discord NO vuelve a notificar; permitirlo mantiene el
        // resaltado de la mención en el manual.
        allowed_mentions: { parse: opts.everyone ? ["everyone"] : [] },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const DIV = "━━━━━━━━━━━━━━━━━━━━━━━━";

// Manual del evento: se publica una vez al activar y luego se mantiene editado.
// Lleva @everyone (mención real) para que destaque y avise al publicarse.
export const HELP_TEXT = `${DIV}
@everyone
🃏 **INTERCAMBIO DE CARTAS — CLASHIVERSARIO**
_Cambiar cartas por el juego es un rollo: aquí ves de un vistazo quién tiene lo que te falta y cierras el cambio en un clic._

📌 **1. Publica lo que te SOBRA**
• Escribe \`/repetidas\` y marca en los desplegables tus cartas repetidas (⚗️ Elixir · 🖤 Oscuro · 🔨 Constructor · ⭐ Supertropas).
• Se guarda solo, sin botones. Al volver a abrirlo salen ya marcadas: para quitar una, la desmarcas.
• **No hace falta decir lo que te falta**: eso lo ves en tu álbum.

📋 **2. Mira quién tiene lo que buscas**
• Debajo hay un **tablón** con todas las repetidas del clan, agrupadas por carta. Se actualiza solo.
• \`/cartas\` te lo enseña cuando quieras · \`/cartas @alguien\` muestra solo las suyas.

🔄 **3. Pide la carta y cierra el trato**
• ⚠️ Solo se puede cambiar una carta por **otra de la misma sección** (Elixir por Elixir, etc.). El bot ya te ofrece solo las válidas.
• \`/cambiar @jugador <carta>\` → el bot le avisa y le enseña **tus repetidas de esa sección**.
• Él elige en el desplegable la que le falte y **el trato queda cerrado**.
• Las dos cartas salen del tablón automáticamente.

⚔️ **4. Haced el intercambio dentro del juego**
El bot solo os pone de acuerdo; el cambio se hace en Clash como siempre.

💡 Si te vuelve a salir repetida una carta que ya cambiaste, márcala otra vez con \`/repetidas\`.
${DIV}`;

async function ensureHelpMessage(db, cfg) {
  if (cfg.helpMessageId) {
    const ok = await editMessage(cfg.channelId, cfg.helpMessageId, HELP_TEXT, { everyone: true });
    if (ok) return;
  }
  const id = await postMessage(cfg.channelId, HELP_TEXT, { everyone: true });
  if (id) await setSetting(db, "cards_help_message_id", id);
}

// Publica o actualiza el tablón en su canal. Sin canal configurado no hace nada.
export async function refreshBoard(db) {
  const cfg = await getConfig(db);
  if (!cfg.enabled || !cfg.channelId) return;
  // El manual va primero (una sola vez); el tablón queda debajo.
  await ensureHelpMessage(db, cfg);
  const content = renderBoard(await getOffers(db));
  const edited = cfg.messageId ? await editMessage(cfg.channelId, cfg.messageId, content) : false;
  if (!edited) {
    const id = await postMessage(cfg.channelId, content);
    if (id) await setSetting(db, "cards_message_id", id);
  }
}

// Cartas que ofrece un usuario concreto (para ver qué tiene antes de pedirle).
export async function cardsOf(db, discordId) {
  const { data } = await db.from("card_offers").select("card").eq("discord_id", discordId);
  const set = new Set((data ?? []).map((r) => r.card));
  // Devueltas en el orden del álbum, no el de inserción.
  return ALL_CARDS.filter((c) => set.has(c));
}

// Cierra un trato: cada uno deja de ofrecer la carta que entrega y se guarda en
// el historial. El intercambio real se hace en el juego.
export async function closeTrade(db, { asker, owner, askedCard, givenCard }) {
  // Doble comprobación: el juego solo permite cambiar dentro de la misma sección.
  if (!sameCategory(askedCard, givenCard)) {
    throw new Error("Las dos cartas deben ser de la misma sección");
  }
  await db
    .from("card_offers")
    .delete()
    .eq("discord_id", owner.id)
    .eq("card", askedCard); // el dueño ya no la tiene de sobra
  await db
    .from("card_offers")
    .delete()
    .eq("discord_id", asker.id)
    .eq("card", givenCard); // el que pide entrega la suya
  await db.from("card_trades").insert({
    asker_id: asker.id,
    asker_name: asker.name ?? null,
    owner_id: owner.id,
    owner_name: owner.name ?? null,
    asked_card: askedCard,
    given_card: givenCard,
  });
  // Cerrar un trato = haber participado en el evento (si el evento del momento
  // se alimenta de las cartas). Queda como constancia y da su plus en la app.
  await markEventParticipation(db, [asker.id, owner.id]);
  await refreshBoard(db);
}

// Marca a estos usuarios de Discord como participantes del evento activo, pero
// solo si ese evento se nutre de las cartas (auto_source = 'cards').
async function markEventParticipation(db, discordIds) {
  try {
    const { data: evs } = await db
      .from("clan_events")
      .select("id, auto_source")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    const ev = evs?.[0];
    if (!ev || ev.auto_source !== "cards") return;

    // Si el jugador tiene su cuenta vinculada, se guarda con su tag.
    const { data: links } = await db
      .from("members")
      .select("tag, discord_id")
      .in("discord_id", discordIds);
    const tagOf = new Map((links ?? []).map((m) => [m.discord_id, m.tag]));

    const rows = discordIds.map((id) => ({
      event_id: ev.id,
      member_tag: tagOf.get(id) ?? null,
      discord_id: id,
      source: "cards",
    }));
    const conTag = rows.filter((r) => r.member_tag);
    const sinTag = rows.filter((r) => !r.member_tag);
    if (conTag.length > 0) {
      await db
        .from("clan_event_participants")
        .upsert(conTag, { onConflict: "event_id,member_tag" });
    }
    if (sinTag.length > 0) {
      await db
        .from("clan_event_participants")
        .upsert(sinTag, { onConflict: "event_id,discord_id" });
    }
  } catch {
    /* tabla de eventos sin migrar: el trato sigue cerrándose igual */
  }
}

// Ranking de quién ha ayudado más (cartas entregadas), para el resumen.
export async function topTraders(db, limit = 10) {
  const { data } = await db.from("card_trades").select("asker_id, owner_id").limit(5000);
  const count = new Map();
  for (const t of data ?? []) {
    count.set(t.owner_id, (count.get(t.owner_id) ?? 0) + 1);
    count.set(t.asker_id, (count.get(t.asker_id) ?? 0) + 1);
  }
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, n]) => ({ discordId: id, trades: n }));
}

// Quién ofrece las cartas indicadas (para avisar de coincidencias).
export function offerersOf(offers, cards) {
  const set = new Set(cards);
  const out = new Map();
  for (const o of offers) {
    if (!set.has(o.card)) continue;
    if (!out.has(o.card)) out.set(o.card, []);
    out.get(o.card).push(o.discord_id);
  }
  return out;
}
