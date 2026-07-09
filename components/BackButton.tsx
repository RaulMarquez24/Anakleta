"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Vuelve a la pantalla ANTERIOR del historial (no a una URL fija). Si no hay
// historial (se abrió el enlace directo), cae al `fallback`.
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Volver"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="absolute left-3 flex-none rounded-full p-1.5 text-white transition hover:bg-white/15"
    >
      <ArrowLeft className="h-6 w-6" />
    </button>
  );
}
