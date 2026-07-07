import { NextResponse } from "next/server";
import { CocApiError, getClan } from "@/lib/coc";

// Endpoint de prueba del Hito 1: lee el clan directamente de la API de CoC y
// devuelve su JSON. Sirve para verificar que la tubería token+IP+base URL
// funciona antes de montar snapshots y base de datos.
export async function GET() {
  try {
    const clan = await getClan();
    return NextResponse.json(clan);
  } catch (err) {
    if (err instanceof CocApiError) {
      return NextResponse.json(
        { error: err.message, status: err.status, details: err.details },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Error inesperado", details: String(err) },
      { status: 500 },
    );
  }
}
