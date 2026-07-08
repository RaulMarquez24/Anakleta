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
    <AppShell email={user?.email} title="Miembros">
      <p className="mb-3 text-xs font-semibold text-ink-soft">
        {data.members.length} miembros
        {data.clanLevel != null && <> · nivel {data.clanLevel}</>} · captura {fmtDate(data.latestCapture)}
      </p>

      <MembersTable members={data.members} />
    </AppShell>
  );
}
