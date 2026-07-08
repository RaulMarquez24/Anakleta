// Gráfica de líneas en SVG puro (se renderiza en servidor, sin JS de cliente ni
// dependencias). Pensada para series temporales pequeñas (snapshots del clan).

export interface ChartPoint {
  t: number; // timestamp en ms
  v: number; // valor
}
export interface ChartSeries {
  label: string;
  color: string;
  points: ChartPoint[];
}

export function LineChart({
  series,
  height = 180,
  width = 680,
}: {
  series: ChartSeries[];
  height?: number;
  width?: number;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) {
    return (
      <p className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
        Sin datos suficientes todavía (hacen falta al menos 2 capturas).
      </p>
    );
  }

  const ts = all.map((p) => p.t);
  const vs = all.map((p) => p.v);
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  let vMin = Math.min(...vs);
  let vMax = Math.max(...vs);
  if (vMin === vMax) {
    vMin -= 1;
    vMax += 1;
  }

  const pad = { l: 48, r: 14, t: 12, b: 24 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const sx = (t: number) => pad.l + (tMax === tMin ? 0 : ((t - tMin) / (tMax - tMin)) * iw);
  const sy = (v: number) => pad.t + ih - ((v - vMin) / (vMax - vMin)) * ih;

  // 3 líneas de referencia horizontales.
  const gridVals = [vMin, (vMin + vMax) / 2, vMax];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={series.map((s) => s.label).join(", ")}
    >
      {gridVals.map((v, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={sy(v)}
            y2={sy(v)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text x={pad.l - 8} y={sy(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-soft)">
            {Math.round(v)}
          </text>
        </g>
      ))}

      {series.map((s) => {
        const pts = [...s.points].sort((a, b) => a.t - b.t);
        const d = pts.map((p) => `${sx(p.t)},${sy(p.v)}`).join(" ");
        const last = pts[pts.length - 1];
        return (
          <g key={s.label}>
            <polyline points={d} fill="none" stroke={s.color} strokeWidth={2} />
            <circle cx={sx(last.t)} cy={sy(last.v)} r={3} fill={s.color} />
          </g>
        );
      })}
    </svg>
  );
}
