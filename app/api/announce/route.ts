import { NextRequest, NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { sendAnnouncement } from "@/lib/announce";

// POST /api/announce — publica un anuncio en Discord (con imagen adjunta opcional).
// Es un Route Handler (no Server Action) para no toparse con el límite de body
// de las Server Actions al subir imágenes. Auth por sesión (líder/colíder).
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const authClient = await createAuthServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  }

  const r = await sendAnnouncement(formData);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
