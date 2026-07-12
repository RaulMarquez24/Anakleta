import { NextRequest, NextResponse } from "next/server";
import { getCurrentWar } from "@/lib/war";
import { discordConfigured } from "@/lib/discord";
import { sendPendingWarNotice } from "@/lib/war-notify";
import { createServerClient } from "@/lib/supabase/server";
import { logCronRun } from "@/lib/cron-log";

export const maxDuration = 60;

// Tramos de aviso (horas restantes). Escalado progresivo, sin spam:
//  - al entrar en ≤6h se avisa 1 vez;
//  - luego nada hasta ≤3h;
//  - a partir de ≤3h, un aviso por tramo (3, 2, 1) => cada hora al final.
const TIERS = [6, 3, 2, 1];

// POST /api/war-reminder — lo llama el cron (Bearer CRON_SECRET) cada hora.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!discordConfigured) return NextResponse.json({ skip: "discord no configurado" });

  const war = await getCurrentWar().catch(() => null);
  if (!war || war.state !== "inWar") return NextResponse.json({ skip: "sin guerra en curso" });
  // Guerras normales: sin ping automático (no se exige Discord para ellas; el
  // aviso se hace a mano desde la pantalla de guerra si se quiere). Solo CWL.
  if (!war.isCwl) return NextResponse.json({ skip: "guerra normal: sin aviso automático" });
  if (war.pending.length === 0) return NextResponse.json({ skip: "nadie pendiente" });
  if (!war.endTime) return NextResponse.json({ skip: "sin hora de fin" });

  const hoursLeft = (new Date(war.endTime).getTime() - Date.now()) / 3_600_000;
  const satisfied = TIERS.filter((t) => hoursLeft <= t);
  if (satisfied.length === 0) return NextResponse.json({ skip: `quedan ${hoursLeft.toFixed(1)}h (>6h)` });
  const tier = Math.min(...satisfied); // tramo más ajustado alcanzado

  // Clave estable por guerra/ronda para no repetir tramos ya avisados.
  const warKey = `${war.isCwl ? `cwl-r${war.round}` : "war"}-${war.startTime ?? ""}`;

  const svc = createServerClient();
  const { data: rem } = await svc
    .from("war_reminders")
    .select("last_tier")
    .eq("war_key", warKey)
    .maybeSingle();
  const lastTier = (rem?.last_tier as number | null) ?? null;

  // Solo avisamos si es un tramo NUEVO más ajustado que el último avisado.
  if (lastTier != null && tier >= lastTier) {
    return NextResponse.json({ skip: `tramo ${tier}h ya avisado (último ${lastTier}h)` });
  }

  const r = await sendPendingWarNotice(war);
  if (!r.sent) return NextResponse.json({ error: "fallo al enviar a Discord" }, { status: 502 });

  await svc
    .from("war_reminders")
    .upsert({ war_key: warKey, last_tier: tier, updated_at: new Date().toISOString() }, { onConflict: "war_key" });

  const result = {
    ok: true,
    tier,
    hoursLeft: Number(hoursLeft.toFixed(1)),
    pending: war.pending.length,
    pinged: r.pinged,
    unlinked: r.unlinked,
  };
  await logCronRun("war-reminder", true, result, req.headers.get("x-actor") || "cron");
  return NextResponse.json(result);
}
