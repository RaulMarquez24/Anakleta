import { SkeletonShell, SkeletonCards, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Bar className="h-20 rounded-2xl" />
        <Bar className="h-20 rounded-2xl" />
        <Bar className="h-20 rounded-2xl" />
      </div>
      <SkeletonCards n={5} />
    </SkeletonShell>
  );
}
