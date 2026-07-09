import { getMyPlayerTag } from "@/lib/profile";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { PerfilForm } from "./PerfilForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const supabase = await createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const linkedTag = await getMyPlayerTag();

  // Si el tag vinculado es un miembro del clan, mostramos su nombre.
  let linkedName: string | null = null;
  if (linkedTag) {
    const svc = createServerClient();
    const { data } = await svc.from("members").select("name").eq("tag", linkedTag).maybeSingle();
    linkedName = (data?.name as string | null) ?? null;
  }

  return (
    <AppShell email={user?.email} title="Perfil">
      <PerfilForm
        email={user?.email ?? null}
        linkedTag={linkedTag}
        linkedName={linkedName}
      />
    </AppShell>
  );
}
