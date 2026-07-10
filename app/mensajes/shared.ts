// Constantes y tipos compartidos (fuera del archivo "use server", que solo puede
// exportar funciones async).
export const MAX_LEN = 128;

export interface ClanMessage {
  id: number;
  text: string;
  createdBy: string | null;
  createdAt: string | null;
}
