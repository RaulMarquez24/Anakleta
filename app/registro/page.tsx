import { getCronRuns, type CronRun } from "@/lib/cron-log";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

const JOB: Record<string, { label: string; icon: string }> = {
  "th-roles": { label: "Roles de TH", icon: "🏰" },
  "cwl-cron": { label: "CWL (inscripciones)", icon: "🏆" },
  "war-reminder": { label: "Aviso de guerra", icon: "⚔️" },
};

function fmt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

// Resumen de una línea según el tipo de tarea.
function summarize(run: CronRun): string {
  const s = (run.summary ?? {}) as Record<string, unknown>;
  if (run.job === "th-roles") {
    const c = (s.counts ?? {}) as Record<string, number>;
    return `${c.updated ?? 0} actualizados · ${c.noChange ?? 0} sin cambio · ${c.notInGuild ?? 0} fuera del server${c.permFail ? ` · ${c.permFail} fallos` : ""}`;
  }
  if (run.job === "cwl-cron") {
    const a = (s.actions as string[] | undefined) ?? [];
    return a.length ? a.join(" · ") : "sin cambios";
  }
  if (run.job === "war-reminder") {
    return `aviso ≤${s.tier}h · ${s.pinged ?? 0} etiquetados${s.unlinked ? ` · ${s.unlinked} sin Discord` : ""}`;
  }
  return "";
}

// Detalle extra (p. ej. a quién actualizó en roles de TH).
function details(run: CronRun): string[] {
  const s = (run.summary ?? {}) as Record<string, unknown>;
  if (run.job === "th-roles") return (s.updated as string[] | undefined) ?? [];
  return [];
}

export default async function RegistroPage() {
  const user = await getCurrentUser();
  const runs = await getCronRuns(60).catch(() => []);

  return (
    <AppShell email={user?.email} title="Registro de tareas" back="/perfil">
      <p className="mb-4 text-sm text-ink-soft">
        Últimas ejecuciones automáticas (roles de TH, inscripciones de CWL, avisos de guerra).
      </p>

      {runs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/60 p-6 text-center text-sm text-ink-soft">
          Aún no hay ejecuciones registradas.
        </p>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const job = JOB[run.job] ?? { label: run.job, icon: "🔧" };
            const extra = details(run);
            return (
              <div key={run.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex items-center gap-3 px-3.5 py-3">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-2 text-lg">
                    {job.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-extrabold text-ink">
                      {job.label}
                      {!run.ok && (
                        <span className="rounded-full bg-banner/15 px-2 py-0.5 text-[10px] font-extrabold text-banner">
                          con fallos
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-soft">{fmt(run.created_at)}</p>
                  </div>
                </div>
                <div className="border-t border-line px-3.5 py-2.5">
                  <p className="text-sm text-ink">{summarize(run)}</p>
                  {extra.length > 0 && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-xs font-bold text-ink-soft">
                        Ver detalle ({extra.length})
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                        {extra.map((line, i) => (
                          <li key={i}>• {line}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
