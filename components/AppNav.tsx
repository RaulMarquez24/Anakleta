"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Castle, Users, Activity, Swords, UserRound, type LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; Icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/", label: "Clan", Icon: Castle, match: (p) => p === "/" || p.startsWith("/ranking") },
  {
    href: "/miembros",
    label: "Miembros",
    Icon: Users,
    match: (p) => p.startsWith("/miembros") || p.startsWith("/member") || p.startsWith("/bajas"),
  },
  { href: "/actividad", label: "Actividad", Icon: Activity, match: (p) => p.startsWith("/actividad") },
  {
    href: "/guerras",
    label: "Guerras",
    Icon: Swords,
    match: (p) => p.startsWith("/guerra") || p.startsWith("/liga") || p.startsWith("/war"),
  },
  { href: "/perfil", label: "Perfil", Icon: UserRound, match: (p) => p.startsWith("/perfil") },
];

export function AppNav({ variant }: { variant: "top" | "bottom" | "side" }) {
  const pathname = usePathname();

  if (variant === "side") {
    return (
      <nav aria-label="Secciones" className="flex flex-col gap-1">
        {ITEMS.map((it) => {
          const active = it.match(pathname);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${
                active
                  ? "bg-gold text-banner-dark shadow-sm"
                  : "text-[#f6d9b0] hover:bg-white/10"
              }`}
            >
              <it.Icon className="h-5 w-5" strokeWidth={active ? 2.6 : 2.2} />
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

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
              className="flex flex-col items-center gap-1 py-2"
            >
              <span
                className={`flex h-7 w-14 items-center justify-center rounded-full transition ${
                  active ? "bg-gold/25 text-gold-deep" : "text-ink-soft"
                }`}
              >
                <it.Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.6 : 2} />
              </span>
              <span
                className={`text-[11px] font-extrabold ${active ? "text-gold-deep" : "text-ink-soft"}`}
              >
                {it.label}
              </span>
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
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold transition ${
              active ? "bg-gold text-banner-dark" : "text-[#f6d9b0] hover:bg-white/10"
            }`}
          >
            <it.Icon className="h-4 w-4" strokeWidth={2.4} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
