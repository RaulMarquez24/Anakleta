import { SkeletonShell, SkeletonCards, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <div className="mb-4 flex gap-2">
        <Bar className="h-9 flex-1 rounded-full" />
        <Bar className="h-9 w-24 rounded-full" />
      </div>
      <SkeletonCards n={6} />
    </SkeletonShell>
  );
}
