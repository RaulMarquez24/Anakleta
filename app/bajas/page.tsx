import Link from "next/link";
import { getDepartures } from "@/lib/history";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  leader: "Líder",
  coLeader: "Colíder",
  admin: "Veterano",
  member: "Miembro",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(
    new Date(iso),
  );
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export default async function BajasPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const departures = await getDepartures();

  return (
    <AppShell email={user?.email} title="Bajas">
      <div className="mb-4 flex items-baseline justify-end gap-2">
        <Link href="/" className="text-sm font-bold text-sky hover:underline">
          ← Miembros
        </Link>
      </div>

      {departures.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center">
          <p className="text-4xl">👋</p>
          <p className="mt-2 font-bold text-ink-soft">Nadie ha abandonado el clan (aún).</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {departures.map((d) => {
              const stay = daysBetween(d.firstSeenAt, d.lastSeenAt);
              return (
                <li key={d.tag} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-ink">{d.name}</span>
                    <span className="ml-2 text-xs text-ink-soft">
                      {d.role ? (ROLE_LABEL[d.role] ?? d.role) : "—"}
                      {d.townHall != null && <> · TH{d.townHall}</>}
                    </span>
                    <p className="text-xs text-ink-soft">
                      Alta {fmtDate(d.firstSeenAt)}
                      {stay != null && <> · estuvo {stay} día{stay === 1 ? "" : "s"}</>}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-banner/12 px-2.5 py-1 text-xs font-extrabold text-banner">
                    Se fue {fmtDate(d.lastSeenAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        Se registra una baja cuando un tag deja de aparecer en la lista del clan entre capturas (se
        fue o lo expulsaron). La fecha de &ldquo;se fue&rdquo; es la última captura en la que aún estaba.
      </p>
    </AppShell>
  );
}
