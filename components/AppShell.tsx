import Image from "next/image";
import { AppNav } from "@/components/AppNav";
import { WarAlertBubble } from "@/components/WarAlertBubble";
import { getWarAlert } from "@/lib/war-history";

// Marco común de las páginas autenticadas: cabecera con la cinta roja del logo,
// navegación (arriba en escritorio, barra inferior en móvil) y el contenido.
export async function AppShell({
  email,
  title,
  children,
}: {
  email?: string | null;
  title: string;
  children: React.ReactNode;
}) {
  const alert = await getWarAlert().catch(() => null);

  return (
    <div className="min-h-full pb-20 sm:pb-6">
      <header className="bg-banner">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Image
            src="/logo.jpg"
            alt=""
            aria-hidden
            width={44}
            height={44}
            className="h-11 w-11 flex-none rounded-xl shadow-[0_0_0_2px_rgba(255,255,255,.35)]"
          />
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#f6d9b0]">
              Añakleta
            </p>
            <p className="ribbon-title truncate text-2xl leading-none">{title}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <AppNav variant="top" />
            </div>
            {email && (
              <span className="hidden max-w-[14ch] truncate text-xs text-[#f6d9b0] md:inline">
                {email}
              </span>
            )}
            <form action="/auth/signout" method="post">
              <button
                className="rounded-full border border-white/30 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-white/10"
                aria-label="Cerrar sesión"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

      {alert && (
        <WarAlertBubble pendingCount={alert.pendingCount} endsAt={alert.endsAt} label={alert.label} />
      )}

      <AppNav variant="bottom" />
    </div>
  );
}
