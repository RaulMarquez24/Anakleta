import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase de SERVIDOR para leer la SESIÓN de auth desde las cookies.
// Usa la PUBLISHABLE KEY (no la secret): solo sirve para saber quién está
// logueado, no para acceso privilegiado a datos. En Server Components no se
// pueden escribir cookies (el refresco de token lo hace el middleware), así que
// setAll es no-op aquí.
export async function createAuthServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: ignorar (lo refresca el middleware).
        }
      },
    },
  });
}
