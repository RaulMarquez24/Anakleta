"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";

// Lupa del header (inspeccionar). Se oculta si ya estás en la sección
// /inspeccionar (no tiene sentido ofrecerla estando allí).
export function HeaderSearch() {
  const pathname = usePathname();
  if (pathname.startsWith("/inspeccionar")) return null;
  return (
    <Link
      href="/inspeccionar"
      aria-label="Inspeccionar clan o jugador"
      className="absolute right-3 flex-none rounded-full p-1.5 text-white transition hover:bg-white/15"
    >
      <Search className="h-6 w-6" strokeWidth={2.4} />
    </Link>
  );
}
