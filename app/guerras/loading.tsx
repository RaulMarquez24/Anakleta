import { SkeletonShell, SkeletonCards } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <SkeletonCards n={5} />
    </SkeletonShell>
  );
}
