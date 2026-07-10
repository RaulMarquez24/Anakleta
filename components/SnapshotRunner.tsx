"use client";

import { useState } from "react";

interface SnapshotResult {
  ok?: boolean;
  mode?: "light" | "full";
  error?: string;
  cooldown?: boolean;
  message?: string;
  captured_at?: string;
  clan?: string;
  members_captured?: number;
  members_enriched?: number;
  members_deactivated?: number;
  war?: { recorded?: number; cwl?: boolean; attacks?: number } | { error: string } | null;
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
  const [busy, setBusy] = useState<"light" | "full" | null>(null);
  const [res, setRes] = useState<SnapshotResult | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(mode: "light" | "full") {
    setBusy(mode);
    setErr(null);
    setInfo(null);
    setRes(null);
    try {
      const r = await fetch(`/api/snapshot?mode=${mode}`, { method: "POST" });
      const data = (await r.json()) as SnapshotResult;
      if (data.cooldown) setInfo(data.message ?? "Espera un poco antes de repetir.");
      else if (!r.ok || data.error) setErr(data.error ?? `Error ${r.status}`);
      else setRes(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  const war = res?.war && !("error" in res.war) ? res.war : null;
  const warErr = res?.war && "error" in res.war ? res.war.error : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-1 font-extrabold text-ink">🔄 Sincronizar con Clash</h2>
      <p className="mb-3 text-sm text-ink-soft">
        <b>Rápido</b>: miembros, bajas y donaciones (1 llamada, úsalo las veces que quieras).{" "}
        <b>Completo</b>: además estrellas de guerra, ataques, capital y guerra (más pesado).
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => run("light")}
          disabled={busy !== null}
          className="rounded-full border border-line bg-surface-2 px-4 py-2.5 text-sm font-extrabold text-ink transition hover:bg-line disabled:opacity-50"
        >
          {busy === "light" ? "Actualizando…" : "⚡ Refresco rápido"}
        </button>
        <button
          onClick={() => run("full")}
          disabled={busy !== null}
          className="rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
        >
          {busy === "full" ? "Capturando…" : "🧩 Captura completa"}
        </button>
      </div>

      {info && (
        <p className="mt-3 rounded-lg border border-gold/40 bg-gold/12 px-3 py-2 text-sm font-semibold text-gold-deep">
          ⏳ {info}
        </p>
      )}
      {err && (
        <p className="mt-3 rounded-lg border border-banner/40 bg-banner/12 px-3 py-2 text-sm font-semibold text-banner">
          ✕ {err}
        </p>
      )}

      {res && (
        <div className="mt-3">
          <p className="mb-1 text-sm font-bold text-grass">
            ✓ {res.mode === "light" ? "Refresco rápido" : "Captura completa"} · hecho
          </p>
          <Row label="Fecha" value={fmt(res.captured_at)} />
          <Row label="Miembros" value={res.members_captured ?? "—"} />
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
          {res.mode === "full" && (
            <>
              <Row label="Enriquecidos (perfil)" value={res.members_enriched ?? "—"} />
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
            </>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            Puede tardar unos minutos en verse en las pantallas (caché de lectura ~5 min).
          </p>
        </div>
      )}
    </section>
  );
}
