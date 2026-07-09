import { NextRequest, NextResponse } from "next/server";
import { CocApiError, getClan, getPlayer } from "@/lib/coc";
import type { CocClan, CocPlayer } from "@/lib/coc-types";
import { createServerClient } from "@/lib/supabase/server";
import { captureWar, type WarCaptureResult } from "@/lib/war-capture";

// POST /api/snapshot — captura el estado del clan y lo persiste en Supabase.
// Protegido con CRON_SECRET: lo llama el cron externo con la cabecera
//   Authorization: Bearer <CRON_SECRET>
// El dashboard NUNCA llama a este endpoint; solo lee de Supabase.

// El enriquecimiento hace ~1 llamada por miembro a /players; damos margen.
export const maxDuration = 60;

// Ejecuta `worker` sobre `items` con como mucho `limit` en paralelo.
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function POST(req: NextRequest) {
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
    const clan = await getClan<CocClan>();
    const supabase = createServerClient();
    const capturedAt = new Date().toISOString();

    // Enriquecimiento: datos por jugador (/players). Resiliente: si uno falla,
    // sus campos quedan a null y NO se cae la captura entera.
    let enrichedOk = 0;
    const players = await mapPool(clan.memberList, 6, async (m) => {
      try {
        const p = await getPlayer<CocPlayer>(m.tag);
        enrichedOk++;
        return p;
      } catch {
        return null;
      }
    });
    const playerByTag = new Map<string, CocPlayer>();
    players.forEach((p, i) => {
      if (p) playerByTag.set(clan.memberList[i].tag, p);
    });

    // Metadata del clan.
    const { error: clanErr } = await supabase.from("clans").upsert(
      { tag: clan.tag, name: clan.name, level: clan.clanLevel, updated_at: capturedAt },
      { onConflict: "tag" },
    );
    if (clanErr) throw clanErr;

    // Info extra del clan (descripción, liga de guerra, escudo, puntos, racha).
    // Best-effort: si aún no se ha corrido la migración que añade estas columnas,
    // el error se ignora y la captura sigue adelante (el núcleo ya está guardado).
    const { error: clanExtraErr } = await supabase
      .from("clans")
      .update({
        description: clan.description ?? null,
        badge_url: clan.badgeUrls?.medium ?? clan.badgeUrls?.small ?? null,
        war_league: clan.warLeague?.name ?? null,
        clan_points: clan.clanPoints ?? null,
        required_trophies: clan.requiredTrophies ?? null,
        war_wins: clan.warWins ?? null,
        war_win_streak: clan.warWinStreak ?? null,
      })
      .eq("tag", clan.tag);
    // clanExtraErr se ignora a propósito (columnas quizá no migradas todavía).
    void clanExtraErr;

    // Upsert de miembros (preserva first_seen_at; refresca last_seen_at/is_active).
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

    // Bajas: activos que ya no aparecen.
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

    // Serie temporal: una fila por miembro, mismo captured_at.
    const snapshotRows = clan.memberList.map((m) => {
      const p = playerByTag.get(m.tag);
      return {
        member_tag: m.tag,
        captured_at: capturedAt,
        donations: m.donations,
        donations_received: m.donationsReceived,
        trophies: m.trophies,
        builder_trophies: m.builderBaseTrophies ?? null,
        town_hall: m.townHallLevel,
        role: m.role,
        // Sistema de ligas nuevo (Ranked) + XP:
        league_tier_id: m.leagueTier?.id ?? null,
        league_tier_name: m.leagueTier?.name ?? null,
        league_tier_icon: m.leagueTier?.iconUrls?.small ?? null,
        exp_level: m.expLevel ?? null,
        // Enriquecimiento por jugador:
        war_stars: p?.warStars ?? null,
        attack_wins: p?.attackWins ?? null,
        defense_wins: p?.defenseWins ?? null,
        war_preference: p?.warPreference ?? null,
        capital_contributions: p?.clanCapitalContributions ?? null,
      };
    });
    const { error: snapErr } = await supabase
      .from("member_snapshots")
      .insert(snapshotRows);
    if (snapErr) throw snapErr;

    // Grabación de la guerra actual / CWL (para el histórico de participación).
    // Resiliente: si falla (p.ej. war log privado), no tumba la captura.
    let war: WarCaptureResult | { error: string };
    try {
      war = await captureWar(supabase, capturedAt);
    } catch (e) {
      war = { error: String(e) };
    }

    return NextResponse.json({
      ok: true,
      captured_at: capturedAt,
      clan: clan.name,
      members_captured: clan.memberList.length,
      members_enriched: enrichedOk,
      members_deactivated: goneTags.length,
      war,
    });
  } catch (err) {
    if (err instanceof CocApiError) {
      return NextResponse.json(
        { error: err.message, status: err.status, details: err.details },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Fallo al capturar snapshot", details: String(err) },
      { status: 500 },
    );
  }
}
