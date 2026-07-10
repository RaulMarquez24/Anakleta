"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { linkAccounts, unlinkAccount } from "@/app/miembros/actions";
import type { AccountLink } from "@/lib/accounts";

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
  const [busy, setBusy] = useState(false);

  const isSecondary = !!mainTag;
  const primary = group.find((g) => g.mainTag == null);

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
    <div className="space-y-2">
      {/* Grupo de cuentas de la persona */}
      {group.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {group.map((g) => {
            const isPrimary = g.mainTag == null;
            const isSelf = g.tag === tag;
            return (
              <Link
                key={g.tag}
                href={`/member/${encodeURIComponent(g.tag)}`}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  isSelf ? "bg-gold/20 text-gold-deep" : "bg-surface-2 text-ink hover:bg-line"
                }`}
              >
                {isPrimary && "⭐ "}
                {g.name}
                {isSelf && " · esta"}
              </Link>
            );
          })}
        </div>
      )}

      {isSecondary ? (
        <p className="text-sm text-ink-soft">
          Secundaria de <span className="font-bold text-ink">{primary?.name ?? "—"}</span>.{" "}
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
            <option value="">— elegir otra cuenta —</option>
            {candidates.map((c) => (
              <option key={c.tag} value={c.tag}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => act(() => linkAccounts(sel, tag))}
            disabled={!sel || busy}
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-line disabled:opacity-50"
            title="La cuenta elegida pasa a ser secundaria de esta"
          >
            Es secundaria mía
          </button>
          <button
            onClick={() => act(() => linkAccounts(tag, sel))}
            disabled={!sel || busy}
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-line disabled:opacity-50"
            title="Esta cuenta pasa a ser secundaria de la elegida"
          >
            Yo soy la secundaria
          </button>
        </div>
      )}
    </div>
  );
}
