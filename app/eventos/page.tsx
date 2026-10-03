import Link from "next/link";
import { ChevronRight, PartyPopper } from "lucide-react";
import { getEvents, getParticipantCounts } from "@/lib/events";
import { getRulesConfig } from "@/lib/rules";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { EventCreate } from "@/components/EventCreate";

export const dynamic = "force-dynamic";

const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeZone: "Europe/Madrid",
      }).format(new Date(iso))
    : "—";

// Lista de eventos: aquí solo se ven y se crean. Para tocar algo (participantes,
// fechas, cerrarlo) se entra en la ficha del evento.
export default async function EventosPage() {
  const [user, events, rules] = await Promise.all([
    getCurrentUser(),
    getEvents(),
    getRulesConfig(),
  ]);
  const counts = await getParticipantCounts(events.map((e) => e.id));

  const activo = events.find((e) => e.active) ?? null;
  const pasados = events.filter((e) => !e.active);

  return (
    <AppShell email={user?.email} title="Eventos" back="/">
      <p className="mb-4 text-sm text-ink-soft">
        El evento del momento. Participar solo <strong>suma</strong>: deja constancia y da un plus
        de {rules.eventBonus} puntos para los ascensos. A quien no participa no le resta nada.
      </p>

      {activo ? (
        <Link
          href={`/eventos/${activo.id}`}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-grass/40 bg-grass/8 p-4 transition hover:border-grass/70"
        >
          <PartyPopper className="h-6 w-6 flex-none text-grass" />
          <span className="min-w-0 flex-1">
            <span className="mb-0.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-grass/20 px-2.5 py-0.5 text-[11px] font-extrabold text-grass">
                En curso
              </span>
              <span className="truncate font-extrabold text-ink">{activo.name}</span>
            </span>
            <span className="block text-xs text-ink-soft">
              {fecha(activo.startsAt)} – {fecha(activo.endsAt)} ·{" "}
              <strong className="text-ink">{counts.get(activo.id) ?? 0}</strong> participantes
              {activo.autoSource ? " · se marca solo" : ""}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 flex-none text-ink-soft" />
        </Link>
      ) : (
        <p className="mb-4 rounded-2xl border border-dashed border-line p-4 text-sm text-ink-soft">
          No hay ningún evento en curso. Crea uno cuando salga algo que merezca la pena.
        </p>
      )}

      <EventCreate />

      {pasados.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Eventos anteriores
          </p>
          <ul className="space-y-1.5">
            {pasados.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/eventos/${e.id}`}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 transition hover:bg-surface-2/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{e.name}</span>
                    <span className="block text-[11px] text-ink-soft">
                      {fecha(e.startsAt)} – {fecha(e.endsAt)} · {counts.get(e.id) ?? 0}{" "}
                      participantes
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-none text-ink-soft" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
