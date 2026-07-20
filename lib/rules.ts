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
    label: "Robar espejo: ventana final",
    help: "En guerra normal, atacar una base fresca ajena (robar el espejo) solo cuenta como infracción con MÁS de estas horas restantes. Dentro de esta ventana final está permitido.",
    min: 0,
    max: 24,
    unit: "horas restantes",
  },
  {
    key: "warns_threshold",
    prop: "warnsThreshold",
    label: "Warns para «A echar»",
    help: "Nº de warns vigentes que hacen que un miembro pase a la categoría de expulsión.",
    min: 1,
    max: 10,
    unit: "warns",
  },
  {
    key: "warns_expiry_days",
    prop: "warnsExpiryDays",
    label: "Caducidad de warns",
    help: "Días hasta que un warn deja de contar. 0 = no caducan nunca.",
    min: 0,
    max: 365,
    unit: "días",
  },
  {
    key: "inactivity_days",
    prop: "inactivityDays",
    label: "Inactividad para revisar",
    help: "Días sin actividad detectada a partir de los cuales un miembro se marca para revisar.",
    min: 1,
    max: 60,
    unit: "días",
  },
  {
    key: "donation_min",
    prop: "donationMin",
    label: "Donaciones: mínimo",
    help: "Si un miembro dona menos de esto Y recibió bastante más, su balance cuenta como negativo.",
    min: 0,
    max: 20000,
    unit: "tropas",
  },
  {
    key: "donation_gap",
    prop: "donationGap",
    label: "Donaciones: desfase",
    help: "Diferencia (recibido − donado) que dispara el aviso de «balance bajo».",
    min: 0,
    max: 20000,
    unit: "tropas",
  },
];

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
