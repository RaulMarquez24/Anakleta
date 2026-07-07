import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Middleware de sesión + protección de rutas.
// - Refresca el token de Supabase en cada request (patrón oficial @supabase/ssr).
// - Si no hay usuario y la ruta no es pública, redirige a /login.
// - Si hay usuario y va a /login, redirige al dashboard.
// Las rutas /api quedan FUERA: /api/snapshot se protege con CRON_SECRET, no con
// la sesión de usuario.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Ejecuta en todo salvo estáticos y /api (el cron llega a /api/snapshot sin sesión).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
