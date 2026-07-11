import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { CronsPanel } from "@/components/CronsPanel";

export const dynamic = "force-dynamic";

export default async function CronsPage() {
  const user = await getCurrentUser();

  return (
    <AppShell email={user?.email} title="Tareas y crons" back="/perfil">
      <p className="mb-3 text-sm text-ink-soft">
        Lánzalas a mano cuando quieras; se ejecutan solas por su horario. Cada tarea guarda su
        <b> historial</b> (botón en su tarjeta).
      </p>
      <CronsPanel />
    </AppShell>
  );
}
