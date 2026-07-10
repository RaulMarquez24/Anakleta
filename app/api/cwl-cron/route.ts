import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCwlSeasonState } from "@/lib/war";
import { discordConfigured, sendClanMessage, removeGuildRole } from "@/lib/discord";
import { getCwlConfig, refreshLiveList, seasonLabel, type CwlList } from "@/lib/cwl";

export const maxDuration = 60;

const DAY = 86_400_000;

// Temporada candidata (la CWL que toca gestionar) y sus fechas por calendario.
// A partir del día 20 miramos ya al mes siguiente (pre-inscripción ~1 semana).
function candidate(now: Date): { season: string; opens: Date; starts: Date; ends: Date } {
  const bump = now.getUTCDate() >= 20 ? 1 : 0;
  const starts = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + bump, 2, 8, 0, 0));
  const opens = new Date(starts.getTime() - 7 * DAY);
  const ends = new Date(starts.getTime() + 9 * DAY);
  const season = `${starts.getUTCFullYear()}-${String(starts.getUTCMonth() + 1).padStart(2, "0")}`;
  return { season, opens, starts, ends };
}

function fmtDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
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

  // Canal + mención del clan para los avisos.
  const channelId = cfg.listChannelId;
  const mention = cfg.clanRoleId ? `<@&${cfg.clanRoleId}> ` : "";
  const announce = async (text: string) => {
    if (!channelId) return false;
    return sendClanMessage(text, { roles: cfg.clanRoleId ? [cfg.clanRoleId] : [] }, channelId);
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
          channel_id: channelId,
          created_by: "cron",
        })
        .select("*")
        .maybeSingle();
      list = (created as CwlList | null) ?? null;
      if (list) actions.push(`creada lista ${cand.season}`);
    }
  }

  // 2) Avisos + cierre sobre la lista candidata (si existe).
  if (list) {
    const starts = list.starts_at ? new Date(list.starts_at) : cand.starts;
    const opens = list.opens_at ? new Date(list.opens_at) : cand.opens;
    const mid = new Date((opens.getTime() + starts.getTime()) / 2);
    const label = seasonLabel(list.season);
    const patch: Partial<CwlList> = {};

    if (!list.announced_open && nowMs >= opens.getTime()) {
      await refreshLiveList(list.season); // publica el mensaje fijo
      if (await announce(
        `🎉 ${mention}¡Abiertas las inscripciones de la **CWL de ${label}**! ` +
          `Apúntate escribiendo «me apunto» o con \`/apuntar\`. Cierre: ${fmtDate(starts)}.`,
      )) {
        patch.announced_open = true;
        actions.push("aviso apertura");
      }
    }

    if (list.state === "open" && !list.announced_mid && nowMs >= mid.getTime() && nowMs < starts.getTime()) {
      if (await announce(
        `⏳ ${mention}Quedan pocos días para cerrar las inscripciones de la **CWL de ${label}**. ` +
          `Si vas a jugar, apúntate ya («me apunto» o \`/apuntar\`).`,
      )) {
        patch.announced_mid = true;
        actions.push("aviso media semana");
      }
    }

    if (list.state === "open" && !list.announced_last && nowMs >= starts.getTime() - DAY && nowMs < starts.getTime()) {
      if (await announce(
        `⏰ ${mention}¡**Último día** para apuntarte a la CWL de ${label}! ` +
          `Las inscripciones individuales se cierran hoy.`,
      )) {
        patch.announced_last = true;
        actions.push("aviso último día");
      }
    }

    // Cerrar inscripción individual cuando la liga arranca (API o fecha).
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

  return NextResponse.json({ ok: true, season: cand.season, actions });
}
