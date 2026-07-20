import { createServerClient } from "@/lib/supabase/server";

// Configuración de las NORMAS del clan, editable desde el panel /normas. Se
// guarda en la tabla `settings` (clave/valor). Todo tiene default sensato para
// que la app funcione aunque no se haya tocado nada.
export interface RulesConfig {
  stealWindowHours: number; // guerra normal: robar espejo permitido en las últimas N horas
  warnsThreshold: number; // nº de warns vigentes para saltar a "A echar"
  warnsExpiryDays: number; // días hasta que un warn caduca (0 = nunca)
  inactivityDays: number; // días sin actividad para marcar "revisar"
  donationMin: number; // por debajo de esto, si además recibió mucho, cuenta negativo
  donationGap: number; // desfase recibido−donado que dispara "balance bajo"
}

export const RULES_DEFAULTS: RulesConfig = {
  stealWindowHours: 5,
  warnsThreshold: 3,
  warnsExpiryDays: 90,
  inactivityDays: 7,
  donationMin: 1000,
  donationGap: 1000,
};

// Metadatos para pintar el panel de edición (label, ayuda y límites).
export interface RuleField {
  key: string; // clave en `settings`
  prop?: keyof RulesConfig; // presente si el valor lo USA la app (no solo el texto)
  default?: number; // default para valores que no están en RulesConfig (solo texto)
  token: string; // token para el texto de las normas: {token} → valor
  group: string; // agrupación temática en el panel
  affectsApp?: boolean; // true si además cambia la lógica de la app
  label: string;
  help: string;
  min: number;
  max: number;
  unit: string;
}

// Orden de los grupos en el panel de normas.
export const RULE_GROUP_ORDER = [
  "Guerra",
  "Warns",
  "Actividad",
  "Donaciones",
  "Capital y eventos",
  "CWL",
  "Clan",
];
export const RULE_FIELDS: RuleField[] = [
  {
    key: "steal_window_hours",
    prop: "stealWindowHours",
    token: "horas_robo_espejo",
    group: "Guerra",
    affectsApp: true,
    label: "Robar espejo: ventana final",
    help: "En guerra normal, atacar una base fresca ajena (robar el espejo) solo cuenta como infracción con MÁS de estas horas restantes. Dentro de esta ventana final está permitido.",
    min: 0,
    max: 24,
    unit: "horas restantes",
  },
  {
    key: "warns_threshold",
    prop: "warnsThreshold",
    token: "umbral_warns",
    group: "Warns",
    affectsApp: true,
    label: "Warns para «A echar»",
    help: "Nº de warns vigentes que hacen que un miembro pase a la categoría de expulsión.",
    min: 1,
    max: 10,
    unit: "warns",
  },
  {
    key: "warns_expiry_days",
    prop: "warnsExpiryDays",
    token: "caducidad_warns",
    group: "Warns",
    affectsApp: true,
    label: "Caducidad de warns",
    help: "Días hasta que un warn deja de contar. 0 = no caducan nunca.",
    min: 0,
    max: 365,
    unit: "días",
  },
  {
    key: "inactivity_days",
    prop: "inactivityDays",
    token: "dias_inactividad",
    group: "Actividad",
    affectsApp: true,
    label: "Inactividad para revisar",
    help: "Días sin actividad detectada a partir de los cuales un miembro se marca para revisar.",
    min: 1,
    max: 60,
    unit: "días",
  },
  {
    key: "donation_min",
    prop: "donationMin",
    token: "min_donaciones",
    group: "Donaciones",
    affectsApp: true,
    label: "Donaciones: mínimo",
    help: "Si un miembro dona menos de esto Y recibió bastante más, su balance cuenta como negativo.",
    min: 0,
    max: 20000,
    unit: "tropas",
  },
  {
    key: "donation_gap",
    prop: "donationGap",
    token: "desfase_donaciones",
    group: "Donaciones",
    affectsApp: true,
    label: "Donaciones: desfase",
    help: "Diferencia (recibido − donado) que dispara el aviso de «balance bajo».",
    min: 0,
    max: 20000,
    unit: "tropas",
  },
];

// Valores de las normas que SOLO aparecen en el texto (no cambian la lógica de
// la app). También son tokens editables desde el panel.
export const RULE_TEXT_FIELDS: RuleField[] = [
  {
    key: "absence_notice_days",
    token: "dias_avisar_ausencia",
    default: 5,
    group: "Actividad",
    label: "Ausencia: avisar a partir de",
    help: "Días de inactividad tras los que la norma pide avisar.",
    min: 1,
    max: 30,
    unit: "días",
  },
  {
    key: "clan_games_min",
    token: "min_puntos_juegos",
    default: 500,
    group: "Capital y eventos",
    label: "Juegos del Clan: mínimo",
    help: "Puntos mínimos exigidos en los Juegos del Clan.",
    min: 0,
    max: 5000,
    unit: "puntos",
  },
  {
    key: "war_attacks_required",
    token: "ataques_obligatorios",
    default: 2,
    group: "Guerra",
    label: "Guerra: ataques obligatorios",
    help: "Ataques que debe usar quien entra en guerra normal.",
    min: 1,
    max: 2,
    unit: "ataques",
  },
  {
    key: "cwl_accounts",
    token: "cuentas_cwl",
    default: 1,
    group: "CWL",
    label: "CWL: cuentas por persona",
    help: "Nº de cuentas con las que se puede participar en CWL.",
    min: 1,
    max: 3,
    unit: "cuentas",
  },
  {
    key: "founding_year",
    token: "anio_fundacion",
    default: 2022,
    group: "Clan",
    label: "Año de fundación",
    help: "Aparece en la cabecera de las normas.",
    min: 2000,
    max: 2100,
    unit: "año",
  },
];

// Todos los campos numéricos editables (app + solo-texto).
export const ALL_RULE_FIELDS: RuleField[] = [...RULE_FIELDS, ...RULE_TEXT_FIELDS];

// Lee los valores solo-texto desde settings (con default y clamp).
export async function getRuleTextValues(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const f of RULE_TEXT_FIELDS) out[f.token] = f.default ?? 0;
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("settings")
      .select("key, value")
      .in(
        "key",
        RULE_TEXT_FIELDS.map((f) => f.key),
      );
    const byKey = new Map((data ?? []).map((r) => [r.key as string, r.value as string | null]));
    for (const f of RULE_TEXT_FIELDS) {
      const n = Number(byKey.get(f.key));
      if (Number.isFinite(n)) out[f.token] = clamp(n, f.min, f.max);
    }
  } catch {
    /* defaults */
  }
  return out;
}

// Tokens que provienen de la config de la app (RulesConfig).
export function ruleTokenValues(cfg: RulesConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of RULE_FIELDS) if (f.prop) out[f.token] = cfg[f.prop];
  return out;
}

// TODOS los tokens (app + solo-texto) con su valor actual.
export async function getAllTokenValues(): Promise<Record<string, number>> {
  const [cfg, txt] = await Promise.all([getRulesConfig(), getRuleTextValues()]);
  return { ...ruleTokenValues(cfg), ...txt };
}

// Sustituye los tokens {…} del texto por los valores dados. Así el texto de las
// normas refleja automáticamente los ajustes.
export function applyRuleTokens(text: string, values: Record<string, number>): string {
  return text.replace(/\{([a-z_]+)\}/g, (m, tok: string) =>
    tok in values ? String(values[tok]) : m,
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export async function getRulesConfig(): Promise<RulesConfig> {
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("settings")
      .select("key, value")
      .in(
        "key",
        RULE_FIELDS.map((f) => f.key),
      );
    const m = new Map((data ?? []).map((r) => [r.key as string, r.value as string | null]));
    const num = (key: string, def: number) => {
      const n = Number(m.get(key));
      return Number.isFinite(n) ? n : def;
    };
    return {
      stealWindowHours: clamp(num("steal_window_hours", 5), 0, 24),
      warnsThreshold: clamp(num("warns_threshold", 3), 1, 10),
      warnsExpiryDays: clamp(num("warns_expiry_days", 90), 0, 365),
      inactivityDays: clamp(num("inactivity_days", 7), 1, 60),
      donationMin: clamp(num("donation_min", 1000), 0, 20000),
      donationGap: clamp(num("donation_gap", 1000), 0, 20000),
    };
  } catch {
    return { ...RULES_DEFAULTS };
  }
}

// Ventana de robo de espejo en ms (para classifyAttackStatus).
export const stealWindowMs = (hours: number) => hours * 3_600_000;

// --- Texto de las normas (editable y publicable en Discord) ---
export interface RuleTextBlock {
  key: string; // clave en settings
  title: string; // encabezado en el panel
  default: string; // texto por defecto (se puede editar)
}

export const RULE_TEXT_BLOCKS: RuleTextBlock[] = [
  {
    key: "rules_general",
    title: "Normas generales",
    default: `📜 **NORMAS DEL CLAN AÑAKLETA**
✨ *Fuerza y Unión desde {anio_fundacion}*

⚔️ **1. Participación activa**
• Conéctate con regularidad.
• Si vas a estar inactivo más de **{dias_avisar_ausencia} días**, avísalo por Discord o por el chat del clan.

🏹 **2. Donaciones justas**
• Mantén un **buen balance** entre lo que das y recibes.

🛡️ **3. Clan Capital y eventos**
• Participa cada fin de semana en los **Asaltos de Capital**.
• Consigue mínimo **{min_puntos_juegos} puntos** en los Juegos del Clan (salvo excepciones).
• Súmate a los **eventos temporales** del juego.

💬 **4. Respeto y buen ambiente**
• Prohibida cualquier falta de respeto o insulto.
• Todos los niveles y estilos de juego son bienvenidos.
• Si hay algún problema, contacta con un líder o colíder.

🚧 **5. Bases balanceadas**
• Mantén tu aldea **equilibrada**: no subas Ayuntamiento si defensas, muros, héroes o tropas están muy atrasadas.
• Evita bases **denigrantes** (extremadamente débiles para tu nivel).

❌ **6. Expulsiones**
Será expulsado quien: esté +{dias_avisar_ausencia} días inactivo sin aviso · no ataque en guerra sin motivo · falte al respeto.

👑 **7. Ascensos**
• **Veterano:** actividad constante + buen desempeño + buenas donaciones + actitud positiva.
• **Colíder:** jugador de total confianza, estratégico y comunicativo.

🔁 Reacciona con ✅ para confirmar que leíste las normas.`,
  },
  {
    key: "rules_war",
    title: "Guerras normales",
    default: `📢 **NORMAS DE GUERRAS NORMALES** ⚔️

📌 **1. Participación**
• Para participar, **vota en la encuesta** del chat del clan.
• Ajusta tu **disponibilidad de guerra** dentro del juego.
• Si estás en **verde**, estás disponible y **puedes ser incluido** si faltan jugadores. Si entras, **debes cumplir sí o sí**. Si no puedes atacar, **ponte en rojo**.

🎯 **2. Reglas de ataque**
• Si entras, **{ataques_obligatorios} ataques obligatorios**.
• Por defecto (salvo indicación de un líder):
  • **1er ataque:** a tu **espejo** (tu misma posición).
  • **2º ataque:** rematar una base ya atacada, o esperar a las **últimas {horas_robo_espejo} horas** si no hay objetivo asignado.
• Atacar otra base solo con permiso de un líder o acuerdo mutuo confirmado.
• Ataca siempre con **tropas completas y castillo lleno**.

🛠️ **3. Planificación**
• Evita ataques improvisados: revisa repeticiones y pide consejo.

🚫 **4. Sanciones**
• Incumplir supone quedar excluido de próximas guerras y, si se repite, posible expulsión.

💬 **5. Comunicación**
• Coordina dudas o avisos en el chat del clan.
• Respeta siempre las decisiones de líderes y colíderes.

🔁 Reacciona con ✅ para confirmar que leíste las normas.`,
  },
  {
    key: "rules_cwl",
    title: "Liga de Guerras (CWL)",
    default: `📢 **NORMAS DE LA CWL** ⚔️

📌 **1. Participación**
• Solicita participar por Discord días antes (se avisará en el clan).
• Se hace **preselección**: si no puedes atacar todos los días, avisa con tiempo.
• Si entras, **se espera que ataques todos los días**.
• Solo podrás participar con **{cuentas_cwl} cuenta**, a menos que queden huecos libres.

🎯 **2. Reglas de ataque**
• Ataca al **objetivo asignado**; si no hay, a tu **espejo** (ej.: eres la posición 12 → atacas al 12).
• Puedes cambiar objetivo con un compañero si ambos estáis de acuerdo.
• Consulta con un líder si no sabes a quién atacar.

🛠️ **3. Donaciones y ejércitos**
• Dona **exactamente lo que se pide**.
• Usa ejércitos adecuados a tu nivel y al rival.

🚫 **4. Sanciones**
• No atacar sin avisar puede dejarte fuera de futuras CWL y, si se repite, provocar la expulsión.

💬 **5. Comunicación**
• Todo se coordina por el canal #ligas-cwl.
• Es **obligatorio tener Discord** para participar en la CWL.

🔁 Reacciona con ✅ para confirmar que leíste las normas.`,
  },
];

export type RulesText = Record<string, string>;

// Siembra en la BD los bloques que aún no existan, con su texto por defecto. Así
// el texto vive en `settings` y cualquier edición posterior queda persistida y
// se refleja siempre. Idempotente: solo escribe los que falten.
export async function ensureRulesSeeded(): Promise<void> {
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("settings")
      .select("key")
      .in(
        "key",
        RULE_TEXT_BLOCKS.map((b) => b.key),
      );
    const have = new Set((data ?? []).map((r) => r.key as string));
    const missing = RULE_TEXT_BLOCKS.filter((b) => !have.has(b.key)).map((b) => ({
      key: b.key,
      value: b.default,
    }));
    if (missing.length > 0) await svc.from("settings").upsert(missing, { onConflict: "key" });
  } catch {
    /* si falla, se seguirán usando los defaults en memoria */
  }
}

export async function getRulesText(): Promise<RulesText> {
  const out: RulesText = {};
  for (const b of RULE_TEXT_BLOCKS) out[b.key] = b.default;
  try {
    const svc = createServerClient();
    const { data } = await svc
      .from("settings")
      .select("key, value")
      .in(
        "key",
        RULE_TEXT_BLOCKS.map((b) => b.key),
      );
    for (const r of data ?? []) {
      const v = (r.value as string | null) ?? "";
      if (v.trim()) out[r.key as string] = v;
    }
  } catch {
    /* defaults */
  }
  return out;
}
