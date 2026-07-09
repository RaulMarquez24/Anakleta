import { SkeletonShell, SkeletonCards, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-12 rounded-xl" />
        ))}
      </div>
      <SkeletonCards n={6} />
    </SkeletonShell>
  );
}
