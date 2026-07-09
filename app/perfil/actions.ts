"use server";

import { verifyPlayerToken, getPlayer } from "@/lib/coc";
import type { CocPlayer } from "@/lib/coc-types";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerClient } from "@/lib/supabase/server";

// Normaliza un tag a "#ABC123" (mayúsculas, con almohadilla).
function normalizeTag(raw: string): string {
  return "#" + raw.trim().replace(/^#/, "").toUpperCase();
}

export interface LinkResult {
  ok: boolean;
  message: string;
  tag?: string;
  name?: string;
}

// Verifica el token de un solo uso y, si es válido, vincula el tag al usuario.
export async function linkPlayerTag(rawTag: string, token: string): Promise<LinkResult> {
  const auth = await createAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { ok: false, message: "No has iniciado sesión." };

  const tag = normalizeTag(rawTag);
  if (!/^#[0289PYLQGRJCUV]{5,12}$/.test(tag)) {
    return { ok: false, message: "Ese tag no tiene una forma válida." };
  }
  if (!token.trim()) return { ok: false, message: "Falta el token del juego." };

  let status: string;
  try {
    const res = await verifyPlayerToken(tag, token.trim());
    status = res.status;
  } catch {
    return { ok: false, message: "No se pudo verificar el token con la API de Clash." };
  }
  if (status !== "ok") {
    return { ok: false, message: "Token inválido o caducado. Saca uno nuevo en el juego." };
  }

  // Nombre del jugador (para confirmar), best-effort.
  let name: string | undefined;
  try {
    const p = await getPlayer<CocPlayer & { name?: string }>(tag);
    name = p.name;
  } catch {
    /* sin nombre, no pasa nada */
  }

  const svc = createServerClient();
  const { error } = await svc.from("profiles").upsert(
    {
      user_id: user.id,
      player_tag: tag,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) return { ok: false, message: "Verificado, pero falló al guardar el vínculo." };

  return { ok: true, message: "¡Vinculado!", tag, name };
}
