import Image from "next/image";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { getWarAlert } from "@/lib/war-history";

function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "0h";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Marco común de las páginas autenticadas: cabecera con la cinta roja del logo,
// navegación (arriba en escritorio, barra inferior en móvil) y el contenido.
export async function AppShell({
  email,
  children,
}: {
  email?: string | null;
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
            <p className="ribbon-title text-2xl leading-none">AÑAKLETA</p>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#f6d9b0]">
              Fuerza y Unión
            </p>
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

      {/* Aviso global: aún hay gente sin atacar en la guerra en curso */}
      {alert && (
        <Link
          href="/war"
          className="block bg-banner-dark/90 px-4 py-2 text-center text-sm font-bold text-white transition hover:bg-banner-dark"
        >
          ⏰ Aún falta gente por atacar · {alert.pendingCount} sin atacar en {alert.label}
          {alert.endsAt && <> · quedan {timeLeft(alert.endsAt)}</>}
        </Link>
      )}

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

      <AppNav variant="bottom" />
    </div>
  );
}
