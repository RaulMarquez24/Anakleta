import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  discordConfigured,
  getGuildRoles,
  getMemberRoleIds,
  addGuildRole,
  removeGuildRole,
} from "@/lib/discord";

export const maxDuration = 60;

// POST /api/th-roles — cron diario. Pone a cada miembro vinculado el rol de su
// ayuntamiento (por la cuenta PRINCIPAL) y le quita el de otro TH si subió.
// Empareja por nombre de rol: "TH 16", "TH16"… (con o sin espacio).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!discordConfigured) return NextResponse.json({ skip: "discord no configurado" });

  // Mapa TH -> rol, y conjunto de todos los roles de TH (para quitar el que sobre).
  const roles = await getGuildRoles();
  const thRole = new Map<number, string>();
  const allThRoleIds = new Set<string>();
  for (const r of roles) {
    const m = r.name.match(/^th\s*(\d{1,2})$/i);
    if (m) {
      thRole.set(Number(m[1]), r.id);
      allThRoleIds.add(r.id);
    }
  }
  if (thRole.size === 0) return NextResponse.json({ skip: "no hay roles TH en el servidor" });

  // Solo cuentas PRINCIPALES (main_tag null), activas y con Discord vinculado.
  const svc = createServerClient();
  const { data: members } = await svc
    .from("members")
    .select("discord_id, town_hall")
    .eq("is_active", true)
    .is("main_tag", null)
    .not("discord_id", "is", null);

  let updated = 0;
  let noChange = 0;
  let notInGuild = 0;
  let noRoleForTh = 0;

  for (const mem of (members ?? []) as { discord_id: string; town_hall: number | null }[]) {
    const th = mem.town_hall;
    if (!th) continue;
    const desired = thRole.get(th);
    if (!desired) {
      noRoleForTh++;
      continue;
    }
    const current = await getMemberRoleIds(mem.discord_id);
    if (current == null) {
      notInGuild++;
      continue;
    }
    const held = current.filter((id) => allThRoleIds.has(id));
    if (held.length === 1 && held[0] === desired) {
      noChange++;
      continue;
    }
    if (!current.includes(desired)) await addGuildRole(mem.discord_id, desired);
    for (const id of held) if (id !== desired) await removeGuildRole(mem.discord_id, id);
    updated++;
  }

  return NextResponse.json({ ok: true, roles: thRole.size, updated, noChange, notInGuild, noRoleForTh });
}
