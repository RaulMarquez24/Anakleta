import { NextRequest, NextResponse } from "next/server";
import { CocApiError, getClan } from "@/lib/coc";
import type { CocClan } from "@/lib/coc-types";
import { createServerClient } from "@/lib/supabase/server";

// POST /api/snapshot — captura el estado del clan y lo persiste en Supabase.
// Protegido con CRON_SECRET: lo llama el cron externo (Hito 4) con la cabecera
//   Authorization: Bearer <CRON_SECRET>
// El dashboard NUNCA llama a este endpoint; solo lee de Supabase.

export async function POST(req: NextRequest) {
  // 1. Autorización por secreto compartido.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado en el servidor" },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 2. Captura del clan desde la API de CoC.
    const clan = await getClan<CocClan>();
    const supabase = createServerClient();
    const capturedAt = new Date().toISOString();

    // 3. Metadata del clan (una sola fila, upsert por tag).
    const { error: clanErr } = await supabase.from("clans").upsert(
      {
        tag: clan.tag,
        name: clan.name,
        level: clan.clanLevel,
        updated_at: capturedAt,
      },
      { onConflict: "tag" },
    );
    if (clanErr) throw clanErr;

    // 4. Upsert de miembros. Ojo: NO incluimos first_seen_at para no pisarlo en
    //    los que ya existen; en un alta nueva toma el default now(). Sí
    //    refrescamos last_seen_at e is_active=true en cada captura.
    const memberRows = clan.memberList.map((m) => ({
      tag: m.tag,
      name: m.name,
      role: m.role,
      town_hall: m.townHallLevel,
      last_seen_at: capturedAt,
      is_active: true,
    }));
    const { error: membersErr } = await supabase
      .from("members")
      .upsert(memberRows, { onConflict: "tag" });
    if (membersErr) throw membersErr;

    // 5. Bajas: miembros que estaban activos y ya no aparecen en la lista.
    const currentTags = new Set(clan.memberList.map((m) => m.tag));
    const { data: activeMembers, error: activeErr } = await supabase
      .from("members")
      .select("tag")
      .eq("is_active", true);
    if (activeErr) throw activeErr;

    const goneTags = (activeMembers ?? [])
      .map((r) => r.tag as string)
      .filter((tag) => !currentTags.has(tag));

    if (goneTags.length > 0) {
      const { error: goneErr } = await supabase
        .from("members")
        .update({ is_active: false })
        .in("tag", goneTags);
      if (goneErr) throw goneErr;
    }

    // 6. Serie temporal: una fila por miembro, con el mismo captured_at.
    const snapshotRows = clan.memberList.map((m) => ({
      member_tag: m.tag,
      captured_at: capturedAt,
      donations: m.donations,
      donations_received: m.donationsReceived,
      trophies: m.trophies,
      builder_trophies: m.builderBaseTrophies ?? null,
      clan_rank: m.clanRank,
      town_hall: m.townHallLevel,
      role: m.role,
    }));
    const { error: snapErr } = await supabase
      .from("member_snapshots")
      .insert(snapshotRows);
    if (snapErr) throw snapErr;

    return NextResponse.json({
      ok: true,
      captured_at: capturedAt,
      clan: clan.name,
      members_captured: clan.memberList.length,
      members_deactivated: goneTags.length,
    });
  } catch (err) {
    if (err instanceof CocApiError) {
      return NextResponse.json(
        { error: err.message, status: err.status, details: err.details },
        { status: err.status },
      );
    }
    // Errores de Supabase u otros.
    return NextResponse.json(
      { error: "Fallo al capturar snapshot", details: String(err) },
      { status: 500 },
    );
  }
}
