import { createClient } from "@supabase/supabase-js";

// Cliente Supabase de SERVIDOR: usa la SECRET KEY, que bypasea RLS y tiene
// acceso total. Usar SOLO en route handlers / código de servidor. JAMÁS en
// componentes cliente ni exponerla vía variables NEXT_PUBLIC_.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function createServerClient() {
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!secretKey) throw new Error("Falta SUPABASE_SECRET_KEY");

  return createClient(url, secretKey, {
    auth: {
      // El servidor no gestiona sesión de usuario: no persistir ni refrescar.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
