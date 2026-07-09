"use client";

// Imagen del ayuntamiento con fallback: si el TH es nulo o la webp no existe
// (p. ej. un TH nuevo sin imagen aún), cae a /th/unknow.webp.
const FALLBACK = "/th/unknow.webp";

export function ThImage({
  th,
  size = 22,
  className,
}: {
  th: number | null;
  size?: number;
  className?: string;
}) {
  const src = th != null ? `/th/${th}.webp` : FALLBACK;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ height: size, width: size, objectFit: "contain" }}
      loading="lazy"
      onError={(e) => {
        if (!e.currentTarget.src.endsWith(FALLBACK)) e.currentTarget.src = FALLBACK;
      }}
      className={className}
    />
  );
}
