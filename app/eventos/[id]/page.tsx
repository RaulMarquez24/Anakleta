import { notFound } from "next/navigation";
import { getEvent, getResolvedParticipants } from "@/lib/events";
import { getRulesConfig } from "@/lib/rules";
import { getMembersOverview } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { EventDetail, type ParticipantView } from "@/components/EventDetail";

export const dynamic = "force-dynamic";

// Ficha del evento: todo lo que se toca (participantes, fechas, cerrarlo) vive
// aquí dentro; la lista de /eventos es solo para mirar.
export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) notFound();

  const [user, event, rules, data] = await Promise.all([
    getCurrentUser(),
    getEvent(eventId),
    getRulesConfig(),
    getMembersOverview(),
  ]);
  if (!event) notFound();

  const resolved = await getResolvedParticipants(eventId);
  const nameOf = new Map(data.members.map((m) => [m.tag, m.name]));
  const participants: ParticipantView[] = resolved.map((p) => ({
    tag: p.tag,
    name: p.tag ? (nameOf.get(p.tag) ?? p.tag) : "Sin vincular al clan",
    discordId: p.discordId,
    source: p.source,
  }));

  return (
    <AppShell email={user?.email} title="Evento" back="/eventos">
      <EventDetail
        event={{
          id: event.id,
          name: event.name,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          autoSource: event.autoSource,
          active: event.active,
        }}
        participants={participants}
        members={data.members.map((m) => ({
          tag: m.tag,
          name: m.name,
          townHall: m.townHall,
        }))}
        bonus={rules.eventBonus}
      />
    </AppShell>
  );
}
