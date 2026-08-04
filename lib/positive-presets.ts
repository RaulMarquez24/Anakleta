// Atajos y pesos de los positivos (méritos). Fuera de lib/positives.ts porque
// esto lo usa también el cliente (la ficha del miembro).
export const POSITIVE_PRESETS = [
  "Ayudó a un nuevo",
  "Donó de sobra",
  "Guerra perfecta",
  "Salvó la guerra",
  "Tiró de la capital",
  "Organizó la CWL",
  "Buen ambiente",
  "Trajo un fichaje",
];

// Peso del positivo, sobre el valor por defecto de las normas.
export const POSITIVE_WEIGHTS = [
  { key: "detalle", label: "Detalle", factor: 0.5 },
  { key: "normal", label: "Normal", factor: 1 },
  { key: "grande", label: "Grande", factor: 2 },
] as const;

export const pointsFor = (base: number, factor: number) => Math.max(1, Math.round(base * factor));
