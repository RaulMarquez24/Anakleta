import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";
import { WarAlertBubble } from "@/components/WarAlertBubble";
import { getWarAlert } from "@/lib/war-history";

// Marco común de las páginas autenticadas: cabecera con la cinta roja del logo,
// navegación (arriba en escritorio, barra inferior en móvil) y el contenido.
export async function AppShell({
  email,
  title,
  back,
  children,
}: {
  email?: string | null;
  title: string;
  back?: string;
  children: React.ReactNode;
}) {
  const alert = await getWarAlert().catch(() => null);

  return (
    <div className="min-h-full pb-20 sm:pb-6">
      <header className="sticky top-0 z-30 border-b-2 border-gold/40 bg-gradient-to-b from-banner to-banner-dark shadow-lg">
        <div className="relative mx-auto flex max-w-5xl items-center justify-center px-4 py-3">
          {back && <BackButton fallback={back} />}

          {/* Marca / título centrado */}
          <div className="min-w-0 text-center">
            {back ? (
              <>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f6d9b0]">
                  Añakleta
                </p>
                <p className="ribbon-title truncate text-2xl leading-none">{title}</p>
              </>
            ) : (
              <Link href="/" aria-label="Inicio">
                <p className="ribbon-title truncate text-3xl leading-none">Añakleta</p>
              </Link>
            )}
          </div>

          {/* Lupa: inspeccionar cualquier clan/jugador por tag (siempre visible) */}
          <Link
            href="/inspeccionar"
            aria-label="Inspeccionar clan o jugador"
            className="absolute right-3 flex-none rounded-full p-1.5 transition hover:bg-white/15"
          >
            <span aria-hidden className="text-2xl leading-none">🔍</span>
          </Link>

          {/* Nav + email a la derecha (solo escritorio; no descentra en móvil) */}
          <div className="absolute right-14 hidden items-center gap-3 sm:flex">
            <AppNav variant="top" />
            {email && (
              <span className="hidden max-w-[16ch] truncate rounded-full bg-black/15 px-2.5 py-1 text-xs font-semibold text-[#f6d9b0] md:inline">
                {email}
              </span>
            )}
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
