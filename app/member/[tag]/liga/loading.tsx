import { SkeletonShell, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      <SkeletonCards n={6} />
    </SkeletonShell>
  );
}
