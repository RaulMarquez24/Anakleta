import { createServerClient } from "@/lib/supabase/server";

export interface AccountLink {
  tag: string;
  name: string;
  mainTag: string | null; // null = principal/independiente
}

// Todos los miembros activos con su vínculo de cuenta (principal/secundaria).
// Resiliente: si main_tag no está migrada, viene undefined -> null.
export async function getAccountLinks(): Promise<AccountLink[]> {
  const svc = createServerClient();
  const { data } = await svc.from("members").select("*").eq("is_active", true);
  return (data ?? []).map((m) => ({
    tag: m.tag as string,
    name: m.name as string,
    mainTag: (m.main_tag as string | null) ?? null,
  }));
}

// Dado un tag, devuelve el grupo de cuentas de esa persona: raíz (principal) +
// todas las secundarias que apuntan a ella.
export function accountGroup(links: AccountLink[], tag: string): { root: string; members: AccountLink[] } {
  const byTag = new Map(links.map((l) => [l.tag, l]));
  const self = byTag.get(tag);
  const root = self?.mainTag ?? tag; // si soy secundaria, mi raíz es mi principal
  const members = links.filter((l) => l.tag === root || l.mainTag === root);
  return { root, members };
}
