// Gráfica de líneas en SVG puro (se renderiza en servidor, sin JS de cliente ni
// dependencias). Pensada para series temporales pequeñas (snapshots del clan).
//
// El viewBox es estrecho (móvil-nativo): como el SVG es w-full, un viewBox ancho
// haría que el texto se encogiera al renderizar en móvil. Con ~360 de ancho el
// texto sale ~1:1 en móvil y escala hacia arriba en pantallas anchas.

export interface ChartPoint {
  t: number; // timestamp en ms
  v: number; // valor
}
export interface ChartSeries {
  label: string;
  color: string;
  points: ChartPoint[];
}

const nf = new Intl.NumberFormat("es-ES");

export function LineChart({
  series,
  height = 150,
  width = 360,
}: {
  series: ChartSeries[];
  height?: number;
  width?: number;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) {
    return (
      <p className="rounded-xl border border-line bg-surface-2 p-4 text-sm text-ink-soft">
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
  // Un pelín de aire arriba y abajo para que la línea no pegue a los bordes.
  // Pero sin bajar de 0 si los datos son positivos (son contadores: un eje
  // negativo no tiene sentido y ensucia las etiquetas).
  const dataMin = vMin;
  const range = vMax - vMin;
  vMin -= range * 0.08;
  vMax += range * 0.08;
  if (dataMin >= 0) vMin = Math.max(0, vMin);

  const pad = { l: 44, r: 14, t: 16, b: 20 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const sx = (t: number) => pad.l + (tMax === tMin ? 0 : ((t - tMin) / (tMax - tMin)) * iw);
  const sy = (v: number) => pad.t + ih - ((v - vMin) / (vMax - vMin)) * ih;

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const uid = series.map((s) => s.label).join("-").replace(/[^a-zA-Z0-9]/g, "");

  // 3 líneas de referencia horizontales.
  const gridVals = [vMin, (vMin + vMax) / 2, vMax];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={series.map((s) => s.label).join(", ")}
    >
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`grad-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {/* Rejilla + etiquetas del eje Y */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={sy(v)}
            y2={sy(v)}
            stroke="var(--line)"
            strokeWidth={1}
            strokeDasharray={i === 0 ? undefined : "3 4"}
          />
          <text
            x={pad.l - 8}
            y={sy(v) + 4}
            textAnchor="end"
            fontSize={12}
            fontWeight={700}
            fill="var(--ink-soft)"
          >
            {nf.format(Math.round(v))}
          </text>
        </g>
      ))}

      {series.map((s, i) => {
        const pts = [...s.points].sort((a, b) => a.t - b.t);
        const line = pts.map((p) => `${sx(p.t)},${sy(p.v)}`).join(" ");
        // Área bajo la línea (cierra contra la base del gráfico).
        const area = `${line} ${sx(pts[pts.length - 1].t)},${pad.t + ih} ${sx(pts[0].t)},${pad.t + ih}`;
        const last = pts[pts.length - 1];
        const label = nf.format(Math.round(last.v));

        // Etiqueta del último valor con "halo" del color del fondo (bg-surface)
        // detrás, para que el número se lea siempre sobre la línea/rejilla.
        const fs = 14;
        const lx = clamp(sx(last.t), pad.l + 20, width - pad.r);
        const ly = clamp(sy(last.v) - 10, pad.t + fs, pad.t + ih);
        const tw = label.length * 8.2 + 8;

        return (
          <g key={s.label}>
            <polygon points={area} fill={`url(#grad-${uid}-${i})`} />
            <polyline
              points={line}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Punto final con aro del color del fondo */}
            <circle cx={sx(last.t)} cy={sy(last.v)} r={6} fill="var(--surface)" />
            <circle cx={sx(last.t)} cy={sy(last.v)} r={4} fill={s.color} />
            {/* Halo + valor */}
            <rect
              x={lx - 4 - tw}
              y={ly - fs}
              width={tw}
              height={fs + 6}
              rx={5}
              fill="var(--surface)"
            />
            <text x={lx - 8} y={ly} textAnchor="end" fontSize={fs} fontWeight={800} fill={s.color}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
