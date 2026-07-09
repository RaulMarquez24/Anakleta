import { SkeletonShell, SkeletonCards, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <Bar className="mb-5 h-20 w-full rounded-2xl" />
      <div className="mb-4 flex gap-2">
        <Bar className="h-10 flex-1 rounded-full" />
        <Bar className="h-10 flex-1 rounded-full" />
      </div>
      <SkeletonCards n={4} />
    </SkeletonShell>
  );
}
