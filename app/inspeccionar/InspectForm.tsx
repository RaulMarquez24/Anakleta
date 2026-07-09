"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InspectForm() {
  const router = useRouter();
  const [type, setType] = useState<"clan" | "player">("clan");
  const [tag, setTag] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const clean = tag.trim().replace(/^#/, "").toUpperCase();
    if (!clean) return;
    router.push(`/inspeccionar/${type}/${encodeURIComponent("#" + clean)}`);
  }

  const seg = (active: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-center text-sm font-extrabold transition ${
      active ? "bg-gold text-banner-dark" : "bg-surface-2 text-ink-soft hover:bg-line"
    }`;

  return (
    <form onSubmit={go} className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setType("clan")} className={seg(type === "clan")}>
          🛡️ Clan
        </button>
        <button type="button" onClick={() => setType("player")} className={seg(type === "player")}>
          👤 Jugador
        </button>
      </div>

      <div>
        <label htmlFor="tag" className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">
          Tag {type === "clan" ? "del clan" : "del jugador"}
        </label>
        <input
          id="tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="#ABC123"
          autoCapitalize="characters"
          className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-sm font-bold text-ink outline-none focus:border-gold"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-banner-dark transition hover:brightness-105"
      >
        Inspeccionar
      </button>
    </form>
  );
}
