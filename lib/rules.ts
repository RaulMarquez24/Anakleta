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
  prop: keyof RulesConfig;
  token: string; // token para el texto de las normas: {token} → valor
  label: string;
  help: string;
  min: number;
  max: number;
  unit: string;
}
export const RULE_FIELDS: RuleField[] = [
  {
    key: "steal_window_hours",
    prop: "stealWindowHours",
    token: "horas_robo_espejo",
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
    label: "Donaciones: desfase",
    help: "Diferencia (recibido − donado) que dispara el aviso de «balance bajo».",
    min: 0,
    max: 20000,
    unit: "tropas",
  },
];

// Sustituye los tokens {…} del texto por los valores de la config. Así el texto
// de las normas refleja automáticamente los ajustes (p. ej. la ventana de robo).
export function ruleTokenValues(cfg: RulesConfig): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of RULE_FIELDS) out[f.token] = cfg[f.prop];
  return out;
}
export function applyRuleTokens(text: string, cfg: RulesConfig): string {
  const values = ruleTokenValues(cfg);
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
✨ *Fuerza y Unión desde 2022*

⚔️ **1. Participación activa**
• Conéctate con regularidad.
• Si vas a estar inactivo más de **5 días**, avísalo en el canal correspondiente.

🏹 **2. Donaciones justas**
• Mantén un **buen balance** entre lo que das y recibes.
• Respeta las tropas solicitadas: ¡no dones lo que no te piden!

🛡️ **3. Clan Capital y eventos**
• Participa cada fin de semana en los **Asaltos de Capital**.
• Consigue mínimo **500 puntos** en los Juegos del Clan (salvo excepciones).
• Súmate a los **eventos temporales** del juego.

💬 **4. Respeto y buen ambiente**
• Prohibida cualquier falta de respeto o insulto.
• Todos los niveles y estilos de juego son bienvenidos.
• Si hay algún problema, contacta con un líder o colíder.

🚧 **5. Bases balanceadas**
• Mantén tu aldea **equilibrada**: no subas Ayuntamiento si defensas, héroes o tropas están muy atrasadas.
• Evita bases **denigrantes** (extremadamente débiles para tu nivel).

❌ **6. Expulsiones**
Será expulsado quien: esté +5 días inactivo sin aviso · no ataque en guerra sin motivo · done mal repetidamente · falte al respeto.

👑 **7. Ascensos**
• **Veterano:** actividad constante + buen desempeño + buenas donaciones + actitud positiva.
• **Colíder:** jugador de total confianza, estratégico y comunicativo.`,
  },
  {
    key: "rules_war",
    title: "Guerras normales",
    default: `📢 **NORMAS DE GUERRAS NORMALES** ⚔️

📌 **1. Participación**
• Para participar, **vota en la encuesta** del chat del clan.
• Ajusta tu **disponibilidad de guerra** dentro del juego (verde = disponible).
• Si estás en verde y entras, **debes cumplir sí o sí**. Si no puedes, ponte en rojo.

🎯 **2. Reglas de ataque**
• Si entras, **2 ataques obligatorios**.
• Por defecto (salvo indicación de un líder):
  • **1er ataque:** a tu **espejo** (tu misma posición).
  • **2º ataque:** rematar una base ya atacada, o esperar a las **últimas {horas_robo_espejo} horas** si no hay objetivo asignado.
• Atacar otra base solo con permiso de un líder o acuerdo mutuo confirmado.
• Ataca siempre con **tropas completas y castillo lleno**.

🛠️ **3. Planificación**
• Evita ataques improvisados: revisa repeticiones y pide consejo.

🚫 **4. Sanciones**
Incumplir supone quedar excluido de próximas guerras y, si se repite, posible expulsión.`,
  },
  {
    key: "rules_cwl",
    title: "Liga de Guerras (CWL)",
    default: `📢 **NORMAS DE LA CWL** ⚔️

📌 **1. Participación**
• Solicita participar por Discord días antes (se avisará en el clan).
• Se hace **preselección**: si no puedes atacar todos los días, avisa con tiempo.
• Si entras, **se espera que ataques todos los días**.
• Solo con **una cuenta**, salvo que queden huecos.

🎯 **2. Reglas de ataque**
• Ataca al **objetivo asignado**; si no hay, a tu **espejo**.
• Puedes cambiar objetivo con un compañero si ambos estáis de acuerdo.
• Consulta con un líder si no sabes a quién atacar.

🛠️ **3. Donaciones y ejércitos**
• Dona **exactamente lo que se pide**.
• Usa ejércitos adecuados a tu nivel y al rival.

🚫 **4. Sanciones**
No atacar sin avisar puede dejarte fuera de futuras CWL y, si se repite, provocar la expulsión.

💬 Es **obligatorio tener Discord** para participar en la CWL.`,
  },
];

export type RulesText = Record<string, string>;

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
