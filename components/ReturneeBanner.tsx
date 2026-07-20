"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { markReturnReviewed } from "@/app/miembros/actions";

// Aviso en la ficha: este jugador ya estuvo antes en el clan. Botón para marcar
// como revisado (revisada su nota/warns de la etapa anterior).
export function ReturneeBanner({
  tag,
  returnedAt,
}: {
  tag: string;
  returnedAt: string | null;
}) {
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  if (hidden) return null;

  const when = returnedAt
    ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(
        new Date(returnedAt),
      )
    : null;

  async function review() {
    setBusy(true);
    const r = await markReturnReviewed(tag);
    setBusy(false);
    if (r.ok) setHidden(true);
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gold/50 bg-gold/12 p-4">
      <RotateCcw className="mt-0.5 h-5 w-5 flex-none text-gold-deep" />
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-ink">Ya estuvo antes en el clan</p>
        <p className="text-sm text-ink-soft">
          Volvió{when ? ` el ${when}` : ""}. Revisa su nota y sus warns por si hay algo de su etapa
          anterior.
        </p>
      </div>
      <button
        onClick={review}
        disabled={busy}
        className="flex-none rounded-full bg-gold px-3 py-1.5 text-xs font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
      >
        {busy ? "…" : "Revisado"}
      </button>
    </div>
  );
}
