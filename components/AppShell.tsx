import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { HeaderSearch } from "@/components/HeaderSearch";
import { PwaInstall } from "@/components/PwaInstall";
import { WarAlertBubble } from "@/components/WarAlertBubble";
import { getWarAlert } from "@/lib/war-history";
import { recordAccess } from "@/lib/access-log";

// Marco común de las páginas autenticadas.
// Móvil: ribbon superior centrado + barra inferior (sin cambios).
// Escritorio: barra lateral fija (estandarte) + cabecera alineada a la izquierda.
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
  const [alert] = await Promise.all([
    getWarAlert().catch(() => null),
    recordAccess(email), // registro de acceso (throttled, best-effort)
  ]);

  return (
    <div className="min-h-full pb-20 sm:pb-0">
      {/* Barra lateral (solo escritorio) */}
      <Sidebar email={email} />

      {/* Columna de contenido: en escritorio, desplazada tras la sidebar */}
      <div className="sm:pl-60">
        {/* Cabecera móvil: ribbon centrado */}
        <header className="sticky top-0 z-20 border-b-2 border-gold/40 bg-gradient-to-b from-banner to-banner-dark shadow-lg sm:hidden">
          <div className="relative flex items-center justify-center px-4 py-3">
            {back && <BackButton fallback={back} />}
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
            <HeaderSearch />
          </div>
        </header>

        {/* Cabecera escritorio: título a la izquierda + lupa a la derecha */}
        <header className="sticky top-0 z-20 hidden border-b-2 border-gold/40 bg-gradient-to-b from-banner to-banner-dark shadow-lg sm:block">
          <div
            className={`relative mx-auto flex max-w-6xl items-center gap-3 px-6 py-3.5 pr-14 ${
              back ? "pl-16" : ""
            }`}
          >
            {back && <BackButton fallback={back} />}
            <div className="min-w-0">
              {back && (
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f6d9b0]">
                  Añakleta
                </p>
              )}
              <h1 className="ribbon-title truncate text-2xl leading-none">{title}</h1>
            </div>
            <HeaderSearch />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>

      {alert && (
        <WarAlertBubble pendingCount={alert.pendingCount} endsAt={alert.endsAt} label={alert.label} />
      )}

      <PwaInstall raised={!!alert} />
      <AppNav variant="bottom" />
    </div>
  );
}
