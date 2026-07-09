"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { MemberOverviewRow } from "@/lib/dashboard";

type SortKey =
  | "rank"
  | "name"
  | "townHall"
  | "expLevel"
  | "trophies"
  | "donations"
  | "ratio"
  | "warStars";

const SORTS: { key: SortKey; label: string; num: boolean }[] = [
  { key: "rank", label: "Rango", num: true },
  { key: "name", label: "Nombre", num: false },
  { key: "townHall", label: "Ayuntamiento", num: true },
  { key: "expLevel", label: "Nivel (XP)", num: true },
  { key: "trophies", label: "Copas", num: true },
  { key: "donations", label: "Donadas", num: true },
  { key: "ratio", label: "Ratio", num: true },
  { key: "warStars", label: "Estrellas guerra", num: true },
];

function roleBadge(role: string | null): { label: string; cls: string } {
  switch (role) {
    case "leader": return { label: "Líder", cls: "bg-gold/25 text-gold-deep" };
    case "coLeader": return { label: "Colíder", cls: "bg-sky/15 text-sky" };
    case "admin": return { label: "Veterano", cls: "bg-magenta/15 text-magenta" };
    default: return { label: "Miembro", cls: "bg-surface-2 text-ink-soft" };
  }
}

// "Golem League 21" -> "Golem 21"; "Legend II" -> "Legend II".
function shortTier(name: string | null): string {
  if (!name) return "Sin rango";
  return name.replace(" League", "");
}

function NewBadge() {
  return (
    <span className="rounded-full bg-grass/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-grass">
      Nuevo
    </span>
  );
}

function valueOf(m: MemberOverviewRow, key: SortKey): number | string {
  switch (key) {
    case "rank": return m.leagueTierId ?? -1;
    case "name": return m.name.toLowerCase();
    case "townHall": return m.townHall ?? -1;
    case "expLevel": return m.expLevel ?? -1;
    case "trophies": return m.trophies ?? -1;
    case "donations": return m.donations ?? -1;
    case "ratio": return m.ratio ?? -1;
    case "warStars": return m.warStars ?? -1;
  }
}

function TierBadge({ m }: { m: MemberOverviewRow }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {m.leagueTierIcon && (
        // Icono servido por api-assets.clashofclans.com; <img> simple (sin optimizar).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.leagueTierIcon} alt="" width={22} height={22} className="h-[22px] w-[22px]" loading="lazy" />
      )}
      <span className="font-semibold text-ink">{shortTier(m.leagueTierName)}</span>
    </span>
  );
}

// Ayuntamiento inline (imagen + "TH 18"), mismo estilo que TierBadge (la liga),
// para que salgan idénticos y apilados. Imagen local /public/th/{n}.webp (1–18).
function ThInline({ th }: { th: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {th != null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/th/${th}.webp`}
          alt=""
          width={22}
          height={22}
          style={{ height: 22, width: 22, objectFit: "contain" }}
          loading="lazy"
        />
      )}
      <span className="font-semibold text-ink">TH {th ?? "—"}</span>
    </span>
  );
}

function WarPref({ pref }: { pref: string | null }) {
  if (pref === "in")
    return <span className="rounded-md bg-grass/15 px-1.5 py-0.5 text-[11px] font-bold text-grass" title="Entra a guerra">⚔️ Sí</span>;
  if (pref === "out")
    return <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-bold text-ink-soft" title="No entra a guerra">💤 No</span>;
  return <span className="text-ink-soft">—</span>;
}

function Activity({ m }: { m: MemberOverviewRow }) {
  if (m.hadChange == null) return <span className="text-xs font-bold text-ink-soft">Sin dato</span>;
  if (m.hadChange)
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-grass">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-grass-bright ring-4 ring-grass/20" />Activo
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-ink-soft">
      <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ink-soft/40" />Sin cambios
    </span>
  );
}

function href(tag: string) {
  return `/member/${encodeURIComponent(tag)}`;
}

export function MembersTable({ members }: { members: MemberOverviewRow[] }) {
  const [key, setKey] = useState<SortKey>("rank");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...members];
    arr.sort((a, b) => {
      const va = valueOf(a, key);
      const vb = valueOf(b, key);
      let cmp: number;
      if (typeof va === "string" || typeof vb === "string") {
        cmp = String(va).localeCompare(String(vb), "es");
      } else {
        cmp = va - vb;
      }
      // Desempate estable por rango desc para que no "salte".
      if (cmp === 0) cmp = (b.leagueTierId ?? -1) - (a.leagueTierId ?? -1);
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [members, key, dir]);

  function toggle(k: SortKey) {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir(k === "name" ? "asc" : "desc");
    }
  }

  const arrow = (k: SortKey) => (k === key ? (dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <>
      {/* Control de orden en móvil */}
      <div className="mb-3 flex items-center gap-2 sm:hidden">
        <label htmlFor="sort" className="text-xs font-bold text-ink-soft">Ordenar por</label>
        <select
          id="sort"
          value={key}
          onChange={(e) => setKey(e.target.value as SortKey)}
          className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-bold text-ink"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-bold text-ink"
          aria-label={dir === "asc" ? "Ascendente" : "Descendente"}
        >
          {dir === "asc" ? "▲" : "▼"}
        </button>
      </div>

      {/* Móvil: tarjetas */}
      <div className="space-y-3 sm:hidden">
        {sorted.map((m) => {
          const rb = roleBadge(m.role);
          const attention = m.donationsNegative;
          return (
            <Link
              key={m.tag}
              href={href(m.tag)}
              className={`block rounded-2xl border border-line bg-surface p-3.5 shadow-sm ${attention ? "border-l-4 border-l-banner" : "border-l-4 border-l-gold"}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-base font-extrabold text-ink">{m.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${rb.cls}`}>{rb.label}</span>
                {m.isNew && <NewBadge />}
                <span className="ml-auto"><WarPref pref={m.warPreference} /></span>
              </div>
              {/* Todo inline: liga · TH · nivel */}
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <TierBadge m={m} />
                <span className="text-ink-soft">·</span>
                <ThInline th={m.townHall} />
                <span className="text-ink-soft">· Nv {m.expLevel ?? "—"}</span>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink">🏆 {m.trophies ?? "—"}</span>
                <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink">🎁 {m.donations ?? "—"}{m.donationsDelta != null && m.donationsDelta > 0 && <span className="ml-1 text-grass">+{m.donationsDelta}</span>} · 📥 {m.donationsReceived ?? "—"}</span>
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${m.donationsNegative ? "bg-banner/12 text-banner" : "bg-grass/15 text-grass"}`}>Ratio {m.ratio == null ? "—" : m.ratio.toFixed(1)}</span>
                {m.warStars != null && <span className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-bold text-ink">⭐ {m.warStars}</span>}
              </div>
              <Activity m={m} />
            </Link>
          );
        })}
      </div>

      {/* Escritorio: tabla ordenable */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-ink-soft">
            <tr>
              <Th onClick={() => toggle("rank")}>Rango{arrow("rank")}</Th>
              <Th onClick={() => toggle("name")}>Miembro{arrow("name")}</Th>
              <Th onClick={() => toggle("townHall")} center>TH{arrow("townHall")}</Th>
              <Th onClick={() => toggle("expLevel")} center>Nv{arrow("expLevel")}</Th>
              <Th onClick={() => toggle("trophies")} right>Copas{arrow("trophies")}</Th>
              <Th center>Guerra</Th>
              <Th onClick={() => toggle("warStars")} right>⭐{arrow("warStars")}</Th>
              <Th onClick={() => toggle("donations")} right>Donadas{arrow("donations")}</Th>
              <Th right>Recib.</Th>
              <Th onClick={() => toggle("ratio")} right>Ratio{arrow("ratio")}</Th>
              <Th center>Actividad</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {sorted.map((m) => {
              const rb = roleBadge(m.role);
              return (
                <tr key={m.tag} className="hover:bg-surface-2/60">
                  <td className="px-3 py-2"><TierBadge m={m} /></td>
                  <td className="px-3 py-2">
                    <Link href={href(m.tag)} className="font-bold text-ink hover:text-gold-deep hover:underline">{m.name}</Link>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${rb.cls}`}>{rb.label}</span>
                    {m.isNew && <span className="ml-1"><NewBadge /></span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1.5">
                      {m.townHall != null && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/th/${m.townHall}.webp`}
                          alt=""
                          width={26}
                          height={26}
                          style={{ height: 26, width: 26, objectFit: "contain" }}
                          loading="lazy"
                        />
                      )}
                      <span className="tabular-nums text-ink-soft">{m.townHall ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-ink-soft tabular-nums">{m.expLevel ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.trophies ?? "—"}</td>
                  <td className="px-3 py-2 text-center"><WarPref pref={m.warPreference} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.warStars ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.donations ?? "—"}{m.donationsDelta != null && m.donationsDelta > 0 && <span className="ml-1 text-xs text-grass">+{m.donationsDelta}</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{m.donationsReceived ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.ratio == null ? "—" : <span className={m.donationsNegative ? "font-bold text-banner" : "text-ink"}>{m.ratio.toFixed(2)}</span>}</td>
                  <td className="px-3 py-2"><div className="flex justify-center"><Activity m={m} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({
  children,
  onClick,
  center,
  right,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  center?: boolean;
  right?: boolean;
}) {
  const align = center ? "text-center" : right ? "text-right" : "text-left";
  return (
    <th className={`px-3 py-2.5 font-bold ${align}`}>
      {onClick ? (
        <button onClick={onClick} className="font-bold hover:text-gold-deep">
          {children}
        </button>
      ) : (
        children
      )}
    </th>
  );
}
