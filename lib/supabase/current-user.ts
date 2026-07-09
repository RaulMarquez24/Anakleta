import { cache } from "react";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

// Usuario actual con getUser() DEDUPLICADO por render (React cache): varias
// llamadas dentro del mismo request comparten una sola validación de sesión
// contra Supabase, en vez de revalidar en cada componente. La validación en sí
// no cambia (sigue siendo getUser, con round-trip), solo se deja de repetir.
export const getCurrentUser = cache(async () => {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
