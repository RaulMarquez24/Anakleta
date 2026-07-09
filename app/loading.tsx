import { SkeletonShell, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      {/* Identidad del clan */}
      <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <Bar className="h-20 w-20 rounded-2xl" />
          <div className="flex-1">
            <Bar className="mb-2 h-6 w-40" />
            <Bar className="h-4 w-24" />
          </div>
          <Bar className="h-12 w-14 rounded-xl" />
        </div>
        <Bar className="mt-3 h-4 w-full" />
        <Bar className="mt-2 h-4 w-2/3" />
      </div>
      {/* Guerra + gestión */}
      <Bar className="mb-4 h-16 w-full rounded-2xl" />
      <Bar className="mb-6 h-24 w-full rounded-2xl" />
      {/* Análisis */}
      <Bar className="mb-4 h-40 w-full rounded-2xl" />
    </SkeletonShell>
  );
}
