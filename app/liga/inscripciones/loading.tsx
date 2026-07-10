import { SkeletonShell, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      <Bar className="mb-4 h-28 w-full rounded-2xl" />
      <Bar className="mb-4 h-24 w-full rounded-2xl" />
      <Bar className="mb-2 h-40 w-full rounded-2xl" />
      <Bar className="h-40 w-full rounded-2xl" />
    </SkeletonShell>
  );
}
