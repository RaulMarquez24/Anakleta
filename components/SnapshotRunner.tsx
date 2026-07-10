"use client";

import { useState } from "react";

interface SnapshotResult {
  ok?: boolean;
  error?: string;
  captured_at?: string;
  clan?: string;
  members_captured?: number;
  members_enriched?: number;
  members_deactivated?: number;
  war?: { recorded?: number; cwl?: boolean; attacks?: number } | { error: string };
}

function fmt(iso?: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-t border-line py-1.5 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="font-extrabold text-ink">{value}</span>
    </div>
  );
}

export function SnapshotRunner() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SnapshotResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const r = await fetch("/api/snapshot", { method: "POST" });
      const data = (await r.json()) as SnapshotResult;
      if (!r.ok || data.error) {
        setErr(data.error ?? `Error ${r.status}`);
      } else {
        setRes(data);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const war = res?.war && !("error" in res.war) ? res.war : null;
  const warErr = res?.war && "error" in res.war ? res.war.error : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-extrabold text-ink">🔄 Forzar captura</h2>
      <p className="mb-3 text-sm text-ink-soft">
        Sincroniza ya con Clash (miembros, bajas, donaciones, guerra) sin esperar a la captura
        automática de cada 6h.
      </p>

      <button
        onClick={run}
        disabled={busy}
        className="rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
      >
        {busy ? "Capturando…" : "Capturar ahora"}
      </button>

      {err && (
        <p className="mt-3 rounded-lg border border-banner/40 bg-banner/12 px-3 py-2 text-sm font-semibold text-banner">
          ✕ {err}
        </p>
      )}

      {res && (
        <div className="mt-3">
          <p className="mb-1 text-sm font-bold text-grass">✓ Captura completada</p>
          <Row label="Fecha" value={fmt(res.captured_at)} />
          <Row label="Clan" value={res.clan ?? "—"} />
          <Row label="Miembros capturados" value={res.members_captured ?? "—"} />
          <Row label="Enriquecidos (perfil)" value={res.members_enriched ?? "—"} />
          <Row
            label="Bajas nuevas"
            value={
              (res.members_deactivated ?? 0) > 0 ? (
                <span className="text-banner">{res.members_deactivated}</span>
              ) : (
                0
              )
            }
          />
          <Row
            label="Guerra"
            value={
              warErr
                ? "sin datos"
                : war
                  ? `${war.recorded ?? 0} ronda${war.recorded === 1 ? "" : "s"}${war.cwl ? " (CWL)" : ""} · ${war.attacks ?? 0} ataques`
                  : "—"
            }
          />
          <p className="mt-2 text-xs text-ink-soft">
            Los cambios pueden tardar unos minutos en verse (las lecturas se cachean ~5 min).
          </p>
        </div>
      )}
    </section>
  );
}
