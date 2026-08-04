import { getEvents, getActiveEvent, getParticipantTags } from "@/lib/events";
import { getRulesConfig } from "@/lib/rules";
import { getMembersOverview } from "@/lib/dashboard";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { EventsPanel, type EventView, type MemberOption } from "@/components/EventsPanel";

export const dynamic = "force-dynamic";

export default async function EventosPage() {
  const [user, events, active, rules, data] = await Promise.all([
    getCurrentUser(),
    getEvents(),
    getActiveEvent(),
    getRulesConfig(),
    getMembersOverview(),
  ]);

  // Nº de participantes por evento (para el historial).
  const counts = new Map<number, number>();
  if (events.length > 0) {
    try {
      const svc = createServerClient();
      const { data: parts } = await svc
        .from("clan_event_participants")
        .select("event_id")
        .in(
          "event_id",
          events.map((e) => e.id),
        )
        .limit(5000);
      for (const p of parts ?? []) {
        const id = p.event_id as number;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    } catch {
      /* sin migrar */
    }
  }

  const toView = (e: (typeof events)[number]): EventView => ({
    id: e.id,
    name: e.name,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    autoSource: e.autoSource,
    active: e.active,
    createdAt: e.createdAt,
    participants: counts.get(e.id) ?? 0,
  });

  const participantTags = active ? [...(await getParticipantTags(active.id))] : [];
  const members: MemberOption[] = data.members.map((m) => ({
    tag: m.tag,
    name: m.name,
    townHall: m.townHall,
  }));

  return (
    <AppShell email={user?.email} title="Eventos" back="/">
      <p className="mb-4 text-sm text-ink-soft">
        El evento del momento. Participar solo <strong>suma</strong>: deja constancia y da un plus
        para los ascensos. A quien no participa no le resta nada.
      </p>
      <EventsPanel
        events={events.map(toView)}
        active={active ? toView(active) : null}
        members={members}
        participantTags={participantTags}
        bonus={rules.eventBonus}
      />
    </AppShell>
  );
}
