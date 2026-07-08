"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "0m";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Burbuja flotante abajo con el aviso de ataques pendientes. Al hacer scroll se
// encoge a una versión compacta (solo ⏰ + número).
export function WarAlertBubble({
  pendingCount,
  endsAt,
  label,
}: {
  pendingCount: number;
  endsAt: string | null;
  label: string;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Link
      href="/war"
      aria-label={`${pendingCount} sin atacar en ${label}, quedan ${timeLeft(endsAt)}`}
      className="fixed bottom-20 right-3 z-40 flex items-center gap-2 rounded-full bg-banner font-extrabold text-white shadow-lg transition-all duration-200 hover:brightness-110 sm:bottom-4"
      style={{ padding: compact ? "0.6rem 0.8rem" : "0.7rem 1rem" }}
    >
      <span aria-hidden className="text-base leading-none">⏰</span>
      {compact ? (
        <span className="text-sm tabular-nums">
          {pendingCount} · {timeLeft(endsAt)}
        </span>
      ) : (
        <span className="text-sm">
          {pendingCount} sin atacar · {timeLeft(endsAt)}
        </span>
      )}
    </Link>
  );
}
