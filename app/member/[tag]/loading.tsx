import { SkeletonShell, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      {/* Hero: Liga | TH + secciones */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-2 divide-x divide-line">
          <div className="flex flex-col items-center gap-2 p-4">
            <Bar className="h-12 w-12 rounded-full" />
            <Bar className="h-4 w-20" />
            <Bar className="h-4 w-12" />
          </div>
          <div className="flex flex-col items-center gap-2 p-4">
            <Bar className="h-14 w-14 rounded-xl" />
            <Bar className="h-4 w-16" />
            <Bar className="h-3 w-12" />
          </div>
        </div>
        <div className="border-t border-line p-4">
          <Bar className="h-6 w-48" />
        </div>
        <div className="border-t border-line p-4">
          <Bar className="h-12 w-full" />
        </div>
      </div>
      <Bar className="mb-5 h-16 w-full rounded-2xl" />
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bar key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Bar className="h-48 w-full rounded-2xl" />
    </SkeletonShell>
  );
}
