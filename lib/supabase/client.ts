import { createClient } from "@supabase/supabase-js";

// Cliente Supabase de NAVEGADOR: usa la PUBLISHABLE KEY (segura para el cliente,
// sujeta a RLS). Se usa para el login del líder/colíderes. La lectura/escritura
// de datos del clan pasa siempre por el servidor, no por este cliente.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function createBrowserClient() {
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createClient(url, publishableKey);
}
