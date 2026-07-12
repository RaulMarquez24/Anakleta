import Link from "next/link";
import { LogOut } from "lucide-react";
import { AppNav } from "@/components/AppNav";

// Barra lateral de escritorio (oculta en móvil, que usa la barra inferior).
// Estandarte rojo+oro con el escudo, la navegación vertical y la cuenta.
export function Sidebar({ email }: { email?: string | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-gold/40 bg-gradient-to-b from-banner to-banner-dark shadow-xl sm:flex">
      <Link
        href="/"
        aria-label="Inicio"
        className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-v3.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 flex-none rounded-full ring-2 ring-gold/50"
        />
        <span className="ribbon-title text-2xl leading-none">Añakleta</span>
      </Link>

      <div className="flex-1 overflow-y-auto p-3">
        <AppNav variant="side" />
      </div>

      <div className="border-t border-white/10 p-3">
        {email && (
          <p className="mb-1.5 truncate px-2 text-[11px] font-semibold text-[#f6d9b0]/80">{email}</p>
        )}
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold text-[#f6d9b0] transition hover:bg-white/10">
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
