import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

// Tag de CoC vinculado al usuario actual (o null). Resiliente: si la tabla
// profiles aún no existe (migración sin correr), devuelve null.
export async function getMyPlayerTag(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const svc = createServerClient();
  const { data } = await svc
    .from("profiles")
    .select("player_tag")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.player_tag as string | null) ?? null;
}
