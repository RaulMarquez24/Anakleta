import { NextRequest, NextResponse } from "next/server";
import { CocApiError, getClan, getPlayer } from "@/lib/coc";
import type { CocClan, CocPlayer } from "@/lib/coc-types";
import { createServerClient } from "@/lib/supabase/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { captureWar, type WarCaptureResult } from "@/lib/war-capture";
import { captureCapitalRaids } from "@/lib/capital";
import { upsertClanCard } from "@/lib/clan-card";
import { logCronRun } from "@/lib/cron-log";

// POST /api/snapshot — captura el estado del clan y lo persiste en Supabase.
// Dos vías de autorización:
//   - Cron externo: cabecera Authorization: Bearer <CRON_SECRET>.
//   - Botón del panel: usuario con sesión iniciada (líder/colíder).
// El dashboard normal solo LEE de Supabase; esto es la escritura bajo demanda.

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
  const auth = req.headers.get("authorization");
  const isCron = !!secret && auth === `Bearer ${secret}`;

  // Si no viene del cron, exige sesión de usuario (el botón "forzar captura").
  if (!isCron) {
    const authClient = await createAuthServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  // Modo: "light" = solo la lista del clan (1 llamada, sin enriquecer ni guerra),
  // para refrescar miembros/bajas/donaciones al momento. "full" = todo.
  const params = new URL(req.url).searchParams;
  const mode = params.get("mode") === "light" ? "light" : "full";
  // recwl=1: recaptura las rondas de CWL ya cerradas para corregir sus datos.
  const redoCwl = params.get("recwl") === "1";

  try {
    const supabase = createServerClient();

    // Cooldown de 5 min SOLO en la captura completa lanzada por un usuario (el
    // cron nunca se bloquea). Evita spam de las ~38 llamadas de enriquecimiento.
    if (mode === "full" && !isCron) {
      const { data: last } = await supabase
        .from("member_snapshots")
        .select("captured_at")
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastAt = last?.captured_at as string | undefined;
      if (lastAt) {
        const ageMs = Date.now() - new Date(lastAt).getTime();
        const COOLDOWN = 5 * 60_000;
        if (ageMs < COOLDOWN) {
          const wait = Math.ceil((COOLDOWN - ageMs) / 60_000);
          return NextResponse.json(
            {
              cooldown: true,
              message: `Ya hubo una captura completa hace poco. Espera ~${wait} min (o usa el refresco rápido).`,
              last_captured_at: lastAt,
            },
            { status: 429 },
          );
        }
      }
    }

    const clan = await getClan<CocClan>();
    const capturedAt = new Date().toISOString();

    // Enriquecimiento (datos por jugador, /players): SOLO en modo completo.
    // Resiliente: si uno falla, sus campos quedan a null.
    let enrichedOk = 0;
    const playerByTag = new Map<string, CocPlayer>();
    if (mode === "full") {
      const players = await mapPool(clan.memberList, 6, async (m) => {
        try {
          const p = await getPlayer<CocPlayer>(m.tag);
          enrichedOk++;
          return p;
        } catch {
          return null;
        }
      });
      players.forEach((p, i) => {
        if (p) playerByTag.set(clan.memberList[i].tag, p);
      });
    }

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

    // Tarjeta viva del clan en Discord: se edita en su sitio con los datos que
    // acabamos de leer (sin llamadas extra a CoC). Best-effort: nunca tumba la
    // captura ni añade latencia crítica.
    try {
      await upsertClanCard(clan);
    } catch {
      /* si falla Discord, la captura sigue */
    }

    // Retornados: tags que YA existían como inactivos y ahora vuelven a estar en
    // la lista. Se detectan ANTES del upsert (que los pondría activos). Pueden
    // tener nota/warns de su etapa anterior → se marcan para revisión.
    const currentTagsArr = clan.memberList.map((m) => m.tag);
    let returnees: string[] = [];
    if (currentTagsArr.length > 0) {
      const { data: existing } = await supabase
        .from("members")
        .select("tag, is_active")
        .in("tag", currentTagsArr);
      returnees = (existing ?? [])
        .filter((e) => e.is_active === false)
        .map((e) => e.tag as string);
    }

    // Estado previo de cada miembro: con él se detecta qué contadores SUBEN en
    // esta captura (=jugó) y los cambios de disponibilidad, sin releer el
    // histórico. Best-effort: si las columnas aún no están migradas, se ignora.
    const prevByTag = new Map<string, Record<string, unknown>>();
    try {
      const { data: prevRows } = await supabase
        .from("members")
        .select(
          "tag, red_since, last_activity_at, last_donation_at, ranked_last_at, ranked_weeks, tracked_weeks, week_key, ranked_this_week, prev_donations, prev_received, prev_attack_wins, prev_war_stars, prev_capital, prev_exp_level, prev_trophies, prev_war_pref",
        )
        .in("tag", currentTagsArr.length > 0 ? currentTagsArr : ["-"]);
      for (const r of prevRows ?? []) prevByTag.set(r.tag as string, r);
    } catch {
      /* columnas de estado sin migrar todavía */
    }
    // Semana actual (lunes) como nº de días desde epoch: clave para el ranked.
    const nowD = new Date(capturedAt);
    const dow = (nowD.getUTCDay() + 6) % 7;
    const curWeek = Math.floor(
      Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), nowD.getUTCDate() - dow) / 86_400_000,
    );

    // Upsert de miembros (preserva first_seen_at; refresca last_seen_at/is_active).
    const memberRows = clan.memberList.map((m) => {
      const p = playerByTag.get(m.tag);
      const prev = prevByTag.get(m.tag) ?? {};
      const num = (v: unknown) => (typeof v === "number" ? v : null);
      const up = (nuevo: number | null | undefined, viejo: unknown) => {
        const a = num(viejo);
        return nuevo != null && a != null && nuevo > a; // subió = estuvo jugando
      };

      // ¿Alguna señal real de juego en esta captura? Ojo con dos casos que no
      // mueven los contadores obvios: las copas RANKED (jugar ranked no siempre
      // sube attack_wins) y los ASALTOS de capital (los ataques del finde no
      // suben capital_contributions, que es el oro donado a las construcciones;
      // esos se marcan aparte, al capturar los asaltos).
      const jugo =
        up(m.donations, prev.prev_donations) ||
        up(m.donationsReceived, prev.prev_received) ||
        up(p?.attackWins, prev.prev_attack_wins) ||
        up(p?.warStars, prev.prev_war_stars) ||
        up(p?.clanCapitalContributions, prev.prev_capital) ||
        up(m.trophies, prev.prev_trophies) ||
        up(m.expLevel, prev.prev_exp_level);
      const dono = up(m.donations, prev.prev_donations);

      // Disponibilidad de guerra: al pasar a rojo se marca el día; al volver a
      // verde se borra. Así "en rojo desde" es exacto sin mirar el histórico.
      const pref = p?.warPreference ?? null;
      const prevPref = (prev.prev_war_pref as string | null) ?? null;
      let redSince = (prev.red_since as string | null) ?? null;
      if (pref === "out") redSince = prevPref === "out" && redSince ? redSince : capturedAt;
      else if (pref != null) redSince = null;

      // Ranked por semanas: al cambiar de semana se cierra la anterior.
      const prevWeek = num(prev.week_key);
      const nuevaSemana = prevWeek == null || prevWeek !== curWeek;
      let trackedWeeks = num(prev.tracked_weeks) ?? 0;
      let rankedWeeks = num(prev.ranked_weeks) ?? 0;
      let rankedThisWeek = Boolean(prev.ranked_this_week);
      if (nuevaSemana) {
        trackedWeeks += 1;
        rankedThisWeek = false;
      }
      const conCopas = (m.trophies ?? 0) > 0;
      if (conCopas && !rankedThisWeek) {
        rankedThisWeek = true;
        rankedWeeks += 1;
      }

      return {
        tag: m.tag,
        name: m.name,
        role: m.role,
        town_hall: m.townHallLevel,
        last_seen_at: capturedAt,
        is_active: true,
        // Estado derivado
        red_since: redSince,
        last_activity_at: jugo ? capturedAt : ((prev.last_activity_at as string | null) ?? null),
        last_donation_at: dono ? capturedAt : ((prev.last_donation_at as string | null) ?? null),
        ranked_last_at: conCopas ? capturedAt : ((prev.ranked_last_at as string | null) ?? null),
        ranked_weeks: rankedWeeks,
        tracked_weeks: trackedWeeks,
        week_key: curWeek,
        ranked_this_week: rankedThisWeek,
        // Últimos valores vistos (para la próxima comparación)
        prev_donations: m.donations ?? null,
        prev_received: m.donationsReceived ?? null,
        prev_attack_wins: p?.attackWins ?? null,
        prev_war_stars: p?.warStars ?? null,
        prev_capital: p?.clanCapitalContributions ?? null,
        prev_exp_level: m.expLevel ?? null,
        prev_trophies: m.trophies ?? null,
        prev_war_pref: pref,
      };
    });
    let membersErr: { message?: string } | null = null;
    {
      const { error } = await supabase.from("members").upsert(memberRows, { onConflict: "tag" });
      membersErr = error;
    }
    if (membersErr) {
      // Reintento sin las columnas de estado (por si aún no están migradas).
      const basicRows = clan.memberList.map((m) => ({
        tag: m.tag,
        name: m.name,
        role: m.role,
        town_hall: m.townHallLevel,
        last_seen_at: capturedAt,
        is_active: true,
      }));
      const { error } = await supabase.from("members").upsert(basicRows, { onConflict: "tag" });
      if (error) throw error;
    }

    // Marca los retornados para revisión (best-effort: columnas quizá sin migrar).
    if (returnees.length > 0) {
      const { error: retErr } = await supabase
        .from("members")
        .update({ returned_at: capturedAt, return_reviewed: false })
        .in("tag", returnees);
      void retErr; // no tumbar la captura si aún no está migrado
    }

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

    // Grabación de la guerra actual / CWL: SOLO en modo completo (el refresco
    // rápido no toca la guerra). Resiliente: si falla, no tumba la captura.
    let war: WarCaptureResult | { error: string } | null = null;
    let capitalRaids: number | { error: string } | null = null;
    if (mode === "full") {
      try {
        war = await captureWar(supabase, capturedAt, { redoCwl });
      } catch (e) {
        war = { error: String(e) };
      }
      // Asaltos de capital (findes). Resiliente: si falla, no tumba la captura.
      try {
        capitalRaids = await captureCapitalRaids(supabase);
      } catch (e) {
        capitalRaids = { error: String(e) };
      }
    }

    const result = {
      ok: true,
      mode,
      captured_at: capturedAt,
      clan: clan.name,
      members_captured: clan.memberList.length,
      members_enriched: enrichedOk,
      members_deactivated: goneTags.length,
      returnees: returnees.length,
      war,
      capital_raids: capitalRaids,
    };
    await logCronRun("snapshot", true, result, req.headers.get("x-actor") || "cron");
    return NextResponse.json(result);
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
