"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { linkAccounts, unlinkAccount } from "@/app/miembros/actions";
import type { AccountLink } from "@/lib/accounts";

function AccChip({ acc, self }: { acc: AccountLink; self: boolean }) {
  return (
    <Link
      href={`/member/${encodeURIComponent(acc.tag)}`}
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
        self ? "bg-gold/20 text-gold-deep" : "bg-surface-2 text-ink hover:bg-line"
      }`}
    >
      {acc.name}
      {self && " · esta"}
    </Link>
  );
}

export function AccountLinker({
  tag,
  mainTag,
  group,
  candidates,
}: {
  tag: string;
  mainTag: string | null;
  group: AccountLink[];
  candidates: AccountLink[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState("");
  const [role, setRole] = useState<"secundaria" | "principal">("secundaria");
  const [busy, setBusy] = useState(false);

  const isSecondary = !!mainTag;
  const primary = group.find((g) => g.mainTag == null);
  const secondaries = group.filter((g) => g.mainTag != null);

  async function act(fn: () => Promise<{ ok: boolean }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      setSel("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {/* Jerarquía del grupo */}
      {group.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-24 flex-none text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
              ⭐ Principal
            </span>
            {primary ? <AccChip acc={primary} self={primary.tag === tag} /> : <span className="text-xs text-ink-soft">—</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-24 flex-none text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">
              Secundarias
            </span>
            {secondaries.length > 0 ? (
              secondaries.map((s) => <AccChip key={s.tag} acc={s} self={s.tag === tag} />)
            ) : (
              <span className="text-xs text-ink-soft">—</span>
            )}
          </div>
        </div>
      )}

      {/* Vincular / desvincular */}
      {isSecondary ? (
        <p className="text-sm text-ink-soft">
          Es secundaria de <span className="font-bold text-ink">{primary?.name ?? "—"}</span>.{" "}
          <button
            onClick={() => act(() => unlinkAccount(tag))}
            disabled={busy}
            className="font-bold text-banner underline disabled:opacity-50"
          >
            Desvincular
          </button>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            <option value="">— elegir cuenta —</option>
            {candidates.map((c) => (
              <option key={c.tag} value={c.tag}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "secundaria" | "principal")}
            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-sm font-semibold text-ink outline-none focus:border-gold"
          >
            <option value="secundaria">como secundaria</option>
            <option value="principal">como principal</option>
          </select>
          <button
            onClick={() =>
              act(() =>
                role === "secundaria" ? linkAccounts(sel, tag) : linkAccounts(tag, sel),
              )
            }
            disabled={!sel || busy}
            className="rounded-full bg-gold px-4 py-1.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? "…" : "Vincular"}
          </button>
        </div>
      )}
      {!isSecondary && (
        <p className="text-[11px] text-ink-soft">
          Elige una cuenta e indica si es <b>secundaria</b> de esta, o la <b>principal</b> (entonces esta
          pasa a ser su secundaria).
        </p>
      )}
    </div>
  );
}
