import { getCurrentUser } from "@/lib/supabase/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { MessagesManager } from "@/components/MessagesManager";
import type { ClanMessage } from "./shared";

export const dynamic = "force-dynamic";

export default async function MensajesPage() {
  const user = await getCurrentUser();

  // select("*") para no romper si aún no está creada la tabla messages.
  let initial: ClanMessage[] = [];
  const svc = createServerClient();
  const { data } = await svc.from("messages").select("*").order("created_at", { ascending: false });
  if (data) {
    initial = data.map((m) => ({
      id: m.id as number,
      text: m.text as string,
      category: (m.category as string | null) ?? "General",
      createdBy: (m.created_by as string | null) ?? null,
      createdAt: (m.created_at as string | null) ?? null,
    }));
  }

  return (
    <AppShell email={user?.email} title="Mensajes" back="/">
      <p className="mb-4 text-sm text-ink-soft">
        Mensajes cortos (máx. 128 caracteres) para reclutar, invitar al Discord o anunciar.
        Escríbelos, guárdalos y cópialos de un toque para pegarlos en Clash.
      </p>
      <MessagesManager initial={initial} />
    </AppShell>
  );
}
