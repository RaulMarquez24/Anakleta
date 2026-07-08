import Link from "next/link";
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-soft">
          {data.members.length} miembros
          {data.clanLevel != null && <> · nivel {data.clanLevel}</>} · captura {fmtDate(data.latestCapture)}
        </p>
        <Link
          href="/bajas"
          className="flex-none rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-soft transition hover:bg-surface-2"
        >
          📤 Bajas
        </Link>
      </div>

      <MembersTable members={data.members} />
    </AppShell>
  );
}
