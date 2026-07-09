import { SkeletonShell, SkeletonCards, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      <Bar className="mb-4 h-36 w-full rounded-2xl" />
      <SkeletonCards n={6} />
    </SkeletonShell>
  );
}
