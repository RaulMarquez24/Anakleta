import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { getGuildMembers } from "@/lib/discord";
import { createServerClient } from "@/lib/supabase/server";
import {
  getActiveList,
  getSignups,
  partition,
  seasonLabel,
  listSeasons,
} from "@/lib/cwl";
import { CwlManager, type CwlEntryView } from "@/components/CwlManager";

export const dynamic = "force-dynamic";

// Próxima temporada sugerida: si estamos a partir del día 20, el mes que viene.
function suggestedSeason(): string {
  const now = new Date();
  const bump = now.getUTCDate() >= 20 ? 1 : 0;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + bump, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const toView = (e: Awaited<ReturnType<typeof getSignups>>[number]): CwlEntryView => ({
  id: e.id,
  name: e.name,
  townHall: e.townHall,
  discordId: e.discord_id,
  source: e.source,
  addedBy: e.added_by,
});

export default async function InscripcionesPage() {
  const user = await getCurrentUser();

  const [list, allSeasons, discordMembers] = await Promise.all([
    getActiveList(),
    listSeasons(),
    getGuildMembers().catch(() => []),
  ]);

  const svc = createServerClient();
  const { data: members } = await svc
    .from("members")
    .select("tag, name, town_hall, discord_id")
    .eq("is_active", true)
    .order("name");
  const clanMembers = (members ?? []).map((m) => ({
    tag: m.tag as string,
    name: m.name as string,
    townHall: (m.town_hall as number | null) ?? null,
    discordId: (m.discord_id as string | null) ?? null,
  }));

  let inside: CwlEntryView[] = [];
  let queue: CwlEntryView[] = [];
  let hiddenNames: string[] = [];
  let cutoff: number | null = null;
  if (list) {
    const part = partition(list, await getSignups(list.season));
    inside = part.inside.map(toView);
    queue = part.queue.map(toView);
    hiddenNames = part.hidden.map((e) => e.name);
    cutoff = part.cutoff;
  }

  const history = allSeasons
    .filter((s) => !list || s.season !== list.season)
    .map((s) => ({ season: s.season, label: seasonLabel(s.season), state: s.state }));

  return (
    <AppShell email={user?.email} title="Inscripciones CWL" back="/guerras?tab=ligas">
      <CwlManager
        season={list?.season ?? null}
        label={list ? seasonLabel(list.season) : null}
        state={list?.state ?? null}
        size={list?.size ?? null}
        cutoff={cutoff}
        closeDate={list?.starts_at ?? null}
        opensAt={list?.opens_at ?? null}
        endsAt={list?.ends_at ?? null}
        inside={inside}
        queue={queue}
        hiddenNames={hiddenNames}
        clanMembers={clanMembers}
        discordMembers={discordMembers}
        history={history}
        suggestedSeason={suggestedSeason()}
      />
    </AppShell>
  );
}
