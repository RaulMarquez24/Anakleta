import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

// Cliente Supabase de NAVEGADOR (para el login). Usa la PUBLISHABLE KEY y guarda
// la sesión en cookies (vía @supabase/ssr), para que el servidor pueda leerla y
// proteger rutas. La lectura de datos del clan NO pasa por aquí: eso es servidor
// con la SECRET KEY.
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return createSsrBrowserClient(url, publishableKey);
}
