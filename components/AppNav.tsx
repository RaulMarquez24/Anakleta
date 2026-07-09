"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Clan", icon: "🏠", match: (p: string) => p === "/" || p.startsWith("/ranking") },
  {
    href: "/miembros",
    label: "Miembros",
    icon: "👥",
    match: (p: string) => p.startsWith("/miembros") || p.startsWith("/member") || p.startsWith("/bajas"),
  },
  { href: "/actividad", label: "Actividad", icon: "🔥", match: (p: string) => p.startsWith("/actividad") },
  {
    href: "/guerras",
    label: "Guerras",
    icon: "⚔️",
    match: (p: string) => p.startsWith("/guerra") || p.startsWith("/liga") || p.startsWith("/war"),
  },
  { href: "/perfil", label: "Perfil", icon: "🙍", match: (p: string) => p.startsWith("/perfil") },
];

export function AppNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();

  if (variant === "bottom") {
    return (
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface sm:hidden"
      >
        {ITEMS.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-extrabold ${
                active ? "text-gold-deep" : "text-ink-soft"
              }`}
            >
              <span aria-hidden className="text-2xl leading-none">{it.icon}</span>
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Secciones" className="flex items-center gap-1">
      {ITEMS.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-extrabold transition ${
              active
                ? "bg-gold text-banner-dark"
                : "text-[#f6d9b0] hover:bg-white/10"
            }`}
          >
            <span aria-hidden className="mr-1">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
