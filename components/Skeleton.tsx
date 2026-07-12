import { AppNav } from "@/components/AppNav";
import { Sidebar } from "@/components/Sidebar";

// Bloque "pulsante" base.
export function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

// Réplica estática del marco (sidebar + cabecera + barra inferior) para los
// estados de carga. Replica AppShell para que la sidebar NO desaparezca al
// navegar: el menú se mantiene fijo y solo "carga" el contenido.
export function SkeletonShell({
  back = false,
  children,
}: {
  back?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full pb-20 sm:pb-0">
      <Sidebar />

      <div className="sm:pl-60">
        {/* Cabecera móvil */}
        <header className="sticky top-0 z-20 border-b-2 border-gold/40 bg-gradient-to-b from-banner to-banner-dark shadow-lg sm:hidden">
          <div className="relative flex items-center justify-center px-4 py-3">
            {back && (
              <span className="absolute left-3 h-9 w-9 animate-pulse rounded-full bg-white/15" />
            )}
            {back ? (
              <div className="text-center">
                <div className="mx-auto mb-1 h-2 w-16 animate-pulse rounded bg-white/20" />
                <div className="mx-auto h-6 w-36 animate-pulse rounded bg-white/25" />
              </div>
            ) : (
              <p className="ribbon-title truncate text-3xl leading-none">Añakleta</p>
            )}
          </div>
        </header>

        {/* Cabecera escritorio */}
        <header className="sticky top-0 z-20 hidden border-b-2 border-gold/40 bg-gradient-to-b from-banner to-banner-dark shadow-lg sm:block">
          <div className="mx-auto flex max-w-5xl items-center px-6 py-3.5">
            <div className="h-6 w-40 animate-pulse rounded bg-white/25" />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>

      <AppNav variant="bottom" />
    </div>
  );
}

// Lista de tarjetas genéricas (miembros, actividad, ranking…).
export function SkeletonCards({ n = 6 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-3.5">
          <Bar className="mb-2 h-5 w-2/3" />
          <Bar className="mb-2 h-4 w-1/2" />
          <Bar className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
