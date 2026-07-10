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

export interface ClanMessage {
  id: number;
  text: string;
  createdBy: string | null;
  createdAt: string | null;
}
