"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Cuenta atrás en formato "1h 34m 12s" (o "34m 12s" si falta menos de 1h).
function fmt(ms: number, withSeconds: boolean): string {
  if (ms <= 0) return "0s";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (!withSeconds) return h > 0 ? `${h}h ${m}m` : `${m}m`;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

// Burbuja flotante abajo con el aviso de ataques pendientes.
// - Cuenta atrás VIVA: tica cada segundo mientras la pestaña está en foco (se
//   pausa al ocultarla para no gastar batería).
// - Al recuperar el foco: router.refresh() para re-traer del servidor los
//   pendientes y el tiempo reales (la guerra en vivo, cacheada 120s) y re-sincro.
// - Al hacer scroll se encoge a la versión compacta.
export function WarAlertBubble({
  pendingCount,
  endsAt,
  label,
}: {
  pendingCount: number;
  endsAt: string | null;
  label: string;
}) {
  const router = useRouter();
  const [compact, setCompact] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Scroll -> compacto.
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Con la pestaña visible:
  //  - tick de 1s para mover la cuenta atrás,
  //  - refresco de datos cada 3 min (re-pide pendientes/tiempo reales al servidor),
  //    aunque nadie toque nada mientras la web está en primer plano.
  // Ambos se pausan al ocultar; al volver, re-sincroniza y refresca al instante.
  useEffect(() => {
    const REFRESH_MS = 180_000;
    let tick: ReturnType<typeof setInterval> | null = null;
    let refresh: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (tick == null) tick = setInterval(() => setNow(Date.now()), 1000);
      if (refresh == null) refresh = setInterval(() => router.refresh(), REFRESH_MS);
    };
    const stop = () => {
      if (tick != null) clearInterval(tick);
      if (refresh != null) clearInterval(refresh);
      tick = null;
      refresh = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        router.refresh(); // al volver, dato fresco al instante
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [router]);

  const msLeft = endsAt ? new Date(endsAt).getTime() - now : 0;

  return (
    <Link
      href="/war"
      aria-label={`${pendingCount} sin atacar en ${label}, quedan ${fmt(msLeft, false)}`}
      className="fixed bottom-20 right-3 z-40 flex items-center gap-2 rounded-full bg-banner font-extrabold text-white shadow-lg transition-all duration-200 hover:brightness-110 sm:bottom-4"
      style={{ padding: compact ? "0.6rem 0.8rem" : "0.7rem 1rem" }}
    >
      <span aria-hidden className="text-base leading-none">⏰</span>
      {compact ? (
        <span className="text-sm tabular-nums" suppressHydrationWarning>
          {pendingCount} · {fmt(msLeft, false)}
        </span>
      ) : (
        <span className="text-sm tabular-nums" suppressHydrationWarning>
          {pendingCount} sin atacar · {fmt(msLeft, true)}
        </span>
      )}
    </Link>
  );
}
