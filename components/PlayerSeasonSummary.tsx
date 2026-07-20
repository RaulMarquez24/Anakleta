import type { MirrorStats } from "@/lib/war-history";
import type { CapitalSummary } from "@/lib/capital";

// Resumen de cumplimiento del jugador: guerra, espejo, donaciones y capital.
// Todo agregado sobre las últimas guerras / findes registrados.
function Chip({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "good" | "info" | "warn" | "bad";
}) {
  const cls = {
    muted: "bg-surface-2 text-ink-soft",
    good: "bg-grass/15 text-grass",
    info: "bg-sky/15 text-sky",
    warn: "bg-gold/15 text-gold-deep",
    bad: "bg-banner/15 text-banner",
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${cls}`}>{label}</span>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function PlayerSeasonSummary({
  war,
  mirror,
  donations,
  capital,
}: {
  war: { played: number; missed: number; attacks: number; stars: number };
  mirror: MirrorStats;
  donations: { donations: number | null; received: number | null; ratio: number | null; negative: boolean };
  capital: CapitalSummary;
}) {
  const nf = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-ES"));
  const missedCapital = capital.weekends - capital.participated;

  return (
    <div className="space-y-2.5">
      <Group title="Guerra">
        <Chip label={`${war.played} jugadas`} />
        {war.missed > 0 ? <Chip label={`${war.missed} sin atacar`} tone="bad" /> : <Chip label="0 sin atacar" tone="good" />}
        <Chip label={`${war.attacks} ataques`} />
        <Chip label={`⭐ ${war.stars}`} tone="warn" />
      </Group>

      {mirror.attacks > 0 && (
        <Group title="Espejo (últimas guerras)">
          <Chip label={`${mirror.mirror} espejo`} tone="good" />
          {mirror.cleanup > 0 && <Chip label={`${mirror.cleanup} remate`} tone="info" />}
          {mirror.late > 0 && <Chip label={`${mirror.late} libre (5h)`} />}
          {mirror.offmirror > 0 && <Chip label={`${mirror.offmirror} fuera (CWL)`} tone="warn" />}
          {mirror.stolen > 0 ? (
            <Chip label={`${mirror.stolen} robó espejo`} tone="bad" />
          ) : (
            <Chip label="0 robos" tone="good" />
          )}
        </Group>
      )}

      <Group title="Donaciones (temporada)">
        <Chip label={`Dado ${nf(donations.donations)}`} />
        <Chip label={`Recibido ${nf(donations.received)}`} />
        {donations.ratio != null && <Chip label={`ratio ${donations.ratio.toFixed(1)}`} />}
        {donations.negative && <Chip label="balance bajo" tone="bad" />}
      </Group>

      <Group title="Asaltos de capital">
        {capital.weekends === 0 ? (
          <Chip label="sin datos aún" />
        ) : (
          <>
            <Chip
              label={`${capital.participated}/${capital.weekends} findes`}
              tone={missedCapital > 0 ? "warn" : "good"}
            />
            <Chip label={`${capital.attacksUsed}/${capital.attacksPossible} ataques`} />
            <Chip label={`🏛️ ${nf(capital.looted)}`} />
          </>
        )}
      </Group>
    </div>
  );
}
