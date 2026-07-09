"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Lupa del header (inspeccionar). Se oculta si ya estás en la sección
// /inspeccionar (no tiene sentido ofrecerla estando allí).
export function HeaderSearch() {
  const pathname = usePathname();
  if (pathname.startsWith("/inspeccionar")) return null;
  return (
    <Link
      href="/inspeccionar"
      aria-label="Inspeccionar clan o jugador"
      className="absolute right-3 flex-none rounded-full p-1.5 transition hover:bg-white/15"
    >
      <span aria-hidden className="text-2xl leading-none">🔍</span>
    </Link>
  );
}
