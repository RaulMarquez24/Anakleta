import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

// Cierra la sesión y redirige a /login. En route handlers sí se pueden escribir
// cookies, así que el cliente de auth de servidor limpia la sesión correctamente.
export async function POST(request: Request) {
  const supabase = await createAuthServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
