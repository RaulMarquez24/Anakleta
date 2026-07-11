// Constantes y tipos compartidos (fuera del archivo "use server", que solo puede
// exportar funciones async).
export const MAX_LEN = 128;

// Plantillas de reclutamiento listas para copiar (todas ≤ 128 caracteres).
export const RECRUIT_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "Reclutar",
    text: "Añakleta busca jugadores activos para guerras diarias, CWL seria y capital. Donaciones al día, buen ambiente y Discord. ¡Únete!",
  },
  {
    label: "Tras limpieza",
    text: "Limpieza hecha en Añakleta: plazas libres para gente activa. Guerras diarias, CWL y capital, donaciones al día. ¡Entra ya!",
  },
  {
    label: "Competitivo",
    text: "Clan competitivo de guerras y CWL busca THs altos y activos. Se pide participar, donar y Discord. Buen rollo. ¡Te esperamos!",
  },
  {
    label: "Directo",
    text: "¿Activo y con ganas de guerra? Únete a Añakleta: guerras diarias, CWL seria, capital y buen ambiente. Donaciones al día. ¡Vamos!",
  },
];

// Invitación al servidor de Discord del clan.
export const DISCORD_INVITE = "https://discord.gg/p4xKrHEVwa";

// Plantillas para invitar al Discord desde el chat de Clash (todas ≤ 128).
export const DISCORD_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "¿Aún no?",
    text: `¿Aún no estás en el Discord? ¡Únete y no te pierdas ni una CWL! Ponte al día y participa a tope: ${DISCORD_INVITE}`,
  },
  {
    label: "Todo",
    text: `En el Discord de Añakleta está todo: CWL, guerras, diseños y avisos. No te lo pierdas, únete: ${DISCORD_INVITE}`,
  },
  {
    label: "CWL",
    text: `¿Juegas la CWL? Apúntate y organiza las guerras con el clan en nuestro Discord, rápido y sin líos: ${DISCORD_INVITE}`,
  },
  {
    label: "Avisos",
    text: `No te quedes sin atacar: en el Discord avisamos de cada guerra y CWL. Entra y no falles ninguno: ${DISCORD_INVITE}`,
  },
  {
    label: "Diseños",
    text: `Diseños de bases por ayuntamiento, guerras y CWL: lo tienes todo en el Discord de Añakleta. Únete: ${DISCORD_INVITE}`,
  },
  {
    label: "Comunidad",
    text: `Añakleta es más que el clan: Discord con guerras, CWL, diseños, memes y buen rollo. Te esperamos: ${DISCORD_INVITE}`,
  },
  {
    label: "Directo",
    text: `Si estás en el clan, tu sitio está en el Discord: guerras, CWL, diseños y avisos. Únete ahora: ${DISCORD_INVITE}`,
  },
];

export interface ClanMessage {
  id: number;
  text: string;
  createdBy: string | null;
  createdAt: string | null;
}
