import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";
import { InspectForm } from "./InspectForm";

export const dynamic = "force-dynamic";

export default async function InspeccionarPage() {
  const user = await getCurrentUser();

  return (
    <AppShell email={user?.email} title="Inspeccionar" back="/">
      <p className="mb-4 text-sm text-ink-soft">
        Consulta cualquier clan o jugador por su tag, en tiempo real. No se guarda nada: al salir de la
        vista desaparece.
      </p>
      <InspectForm />
      <p className="mt-3 text-xs text-ink-soft">
        El tag es el que aparece en el perfil dentro del juego (empieza por #). Da igual mayúsculas o
        si incluyes la #.
      </p>
    </AppShell>
  );
}
