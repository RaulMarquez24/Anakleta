// Constantes y tipos compartidos (fuera del archivo "use server", que solo puede
// exportar funciones async).
export const MAX_LEN = 128;

// Plantillas de reclutamiento listas para copiar (todas ≤ 128 caracteres).
export const RECRUIT_TEMPLATES: { label: string; text: string }[] = [
  {
    label: "Reclutar",
    text: "Añakleta busca jugadores activos para guerras diarias y CWL. Buen ambiente y Discord. ¡Únete!",
  },
  {
    label: "Tras limpieza",
    text: "Hemos hecho limpieza en Añakleta. Plazas libres para gente activa en CWL y guerras. ¡Entra ya!",
  },
  {
    label: "Competitivo",
    text: "Clan de guerras y CWL busca THs altos y activos. Donaciones al día y buen rollo. ¡Te esperamos!",
  },
  {
    label: "Directo",
    text: "¿Activo y con ganas de guerra? Únete a Añakleta: CWL, guerras diarias y buen ambiente.",
  },
];

export interface ClanMessage {
  id: number;
  text: string;
  createdBy: string | null;
  createdAt: string | null;
}
