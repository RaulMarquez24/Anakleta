import { getMembersOverview } from "@/lib/dashboard";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { AppShell } from "@/components/AppShell";
import { MembersTable } from "@/components/MembersTable";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

export default async function DashboardPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getMembersOverview();

  return (
    <AppShell email={user?.email}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="ribbon-title text-xl text-ink [text-shadow:none]">
          Miembros{" "}
          <span className="font-sans text-sm font-bold text-ink-soft">
            ({data.members.length})
          </span>
        </h1>
        <p className="text-xs font-semibold text-ink-soft">
          {data.clanLevel != null && <>Nivel {data.clanLevel} · </>}
          Captura: {fmtDate(data.latestCapture)}
        </p>
      </div>

      <MembersTable members={data.members} />

      <p className="mt-3 text-xs text-ink-soft">
        Orden por <strong>Rango</strong> (liga del sistema nuevo) por defecto — las copas ya no
        sirven para comparar entre miembros. Toca una cabecera (o usa el selector en móvil) para
        reordenar. Ratio &lt; 1 = recibe más de lo que dona. Toca un miembro para ver su evolución.
      </p>
    </AppShell>
  );
}
