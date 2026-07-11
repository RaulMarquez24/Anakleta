import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCwlSeasonState } from "@/lib/war";
import { discordConfigured, sendClanMessage, removeGuildRole } from "@/lib/discord";
import { getCwlConfig, refreshLiveList, sendOpenAnnouncement, seasonLabel, type CwlList } from "@/lib/cwl";
import { logCronRun } from "@/lib/cron-log";

export const maxDuration = 60;

const DAY = 86_400_000;

// PRÓXIMA CWL a gestionar y sus fechas por calendario. La liga arranca ~día 2.
// Si el inicio de este mes ya pasó (con 2 días de margen), miramos al mes que
// viene. Así el 11/07 la candidata es AGOSTO, no la de julio ya jugada.
function candidate(now: Date): { season: string; opens: Date; starts: Date; ends: Date } {
  let starts = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 2, 8, 0, 0));
  if (now.getTime() > starts.getTime() + 2 * DAY) {
    starts = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 2, 8, 0, 0));
  }
  const opens = new Date(starts.getTime() - 7 * DAY);
  const ends = new Date(starts.getTime() + 9 * DAY);
  const season = `${starts.getUTCFullYear()}-${String(starts.getUTCMonth() + 1).padStart(2, "0")}`;
  return { season, opens, starts, ends };
}

// POST /api/cwl-cron — lo llama el cron diario (Bearer CRON_SECRET).
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!discordConfigured) return NextResponse.json({ skip: "discord no configurado" });

  const svc = createServerClient();
  const cfg = await getCwlConfig();
  const now = new Date();
  const nowMs = now.getTime();
  const cand = candidate(now);
  const actions: string[] = [];

  // Estado real de la CWL según CoC (para cerrar al arrancar y detectar el fin).
  const coc = await getCwlSeasonState().catch(() => ({ season: null, state: null, active: false }));

  // La LISTA fija vive en #ligas-cwl; los AVISOS van a #general.
  const listChannelId = cfg.listChannelId;
  const listMention = listChannelId ? `<#${listChannelId}>` : "";
  const mention = cfg.clanRoleId ? `<@&${cfg.clanRoleId}> ` : "";
  const announce = async (text: string) => {
    if (!cfg.announceChannelId) return false;
    return sendClanMessage(text, { roles: cfg.clanRoleId ? [cfg.clanRoleId] : [] }, cfg.announceChannelId);
  };

  // 1) Asegurar la lista de la temporada candidata (crear al abrir la ventana).
  let list: CwlList | null = null;
  {
    const { data } = await svc.from("cwl_lists").select("*").eq("season", cand.season).maybeSingle();
    list = (data as CwlList | null) ?? null;
    if (!list && nowMs >= cand.opens.getTime()) {
      const { data: created } = await svc
        .from("cwl_lists")
        .insert({
          season: cand.season,
          state: "open",
          opens_at: cand.opens.toISOString(),
          starts_at: cand.starts.toISOString(),
          ends_at: cand.ends.toISOString(),
          channel_id: listChannelId,
          created_by: "cron",
        })
        .select("*")
        .maybeSingle();
      list = (created as CwlList | null) ?? null;
      if (list) {
        await refreshLiveList(list.season); // publica el mensaje fijo en #ligas-cwl
        actions.push(`creada lista ${cand.season}`);
      }
    }
  }

  // 2) Avisos + cierre sobre la lista candidata (si existe).
  if (list) {
    const starts = list.starts_at ? new Date(list.starts_at) : cand.starts;
    const opens = list.opens_at ? new Date(list.opens_at) : cand.opens;
    const mid = new Date((opens.getTime() + starts.getTime()) / 2);
    const label = seasonLabel(list.season);
    const patch: Partial<CwlList> = {};

    // Los AVISOS solo para ligas que gestiona el cron. Si la inscripción se creó
    // a mano (created_by = email), el cron la respeta y no anuncia nada.
    const cronOwned = list.created_by === "cron";

    if (
      cronOwned &&
      list.state === "open" &&
      !list.announced_open &&
      nowMs >= opens.getTime() &&
      nowMs < starts.getTime()
    ) {
      // sendOpenAnnouncement usa el canal de avisos y marca announced_open.
      if (await sendOpenAnnouncement(list.season)) actions.push("aviso apertura");
    }

    if (cronOwned && list.state === "open" && !list.announced_mid && nowMs >= mid.getTime() && nowMs < starts.getTime()) {
      if (await announce(
        `⏳ ${mention}Quedan pocos días para cerrar las inscripciones de la **CWL de ${label}**. ` +
          `Si vas a jugar, escribe «**participo**»${listMention ? ` — lista en ${listMention}` : ""}.`,
      )) {
        patch.announced_mid = true;
        actions.push("aviso media semana");
      }
    }

    if (cronOwned && list.state === "open" && !list.announced_last && nowMs >= starts.getTime() - DAY && nowMs < starts.getTime()) {
      if (await announce(
        `⏰ ${mention}¡**Último día** para entrar en la CWL de ${label}! ` +
          `Escribe «**participo**» hoy; luego se cierran las inscripciones individuales.`,
      )) {
        patch.announced_last = true;
        actions.push("aviso último día");
      }
    }

    // Cerrar inscripción individual cuando la liga arranca (API o fecha). Aplica
    // a cualquier lista abierta (también las manuales); si no está abierta, ignora.
    const started = (coc.active && coc.season === list.season) || nowMs >= starts.getTime();
    if (list.state === "open" && started) {
      patch.state = "closed";
      actions.push("inscripción cerrada");
    }

    if (Object.keys(patch).length) {
      await svc.from("cwl_lists").update(patch).eq("season", list.season);
      if (patch.state === "closed") await refreshLiveList(list.season);
    }
  }

  // 3) Fin de liga: retirar el rol CWL de las temporadas ya terminadas (una vez).
  {
    const { data: pending } = await svc
      .from("cwl_lists")
      .select("*")
      .eq("roles_cleared", false);
    for (const l of (pending ?? []) as CwlList[]) {
      const ended =
        (l.ends_at && nowMs > new Date(l.ends_at).getTime()) ||
        (coc.season === l.season && !coc.active && coc.state === "ended");
      if (!ended) continue;
      if (cfg.cwlRoleId) {
        const { data: rows } = await svc
          .from("cwl_signups")
          .select("discord_id")
          .eq("season", l.season)
          .not("discord_id", "is", null);
        for (const r of (rows ?? []) as { discord_id: string }[]) {
          await removeGuildRole(r.discord_id, cfg.cwlRoleId);
        }
      }
      await svc.from("cwl_lists").update({ roles_cleared: true }).eq("season", l.season);
      actions.push(`rol retirado ${l.season}`);
    }
  }

  const result = { ok: true, season: cand.season, actions };
  // Solo dejamos traza si HIZO algo (evita ruido diario cuando no toca nada).
  if (actions.length) await logCronRun("cwl-cron", true, result);
  return NextResponse.json(result);
}
