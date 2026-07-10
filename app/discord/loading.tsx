import { SkeletonShell, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      <Bar className="mb-4 h-4 w-2/3" />
      <Bar className="mb-4 h-28 w-full rounded-2xl" />
      <Bar className="mb-4 h-20 w-full rounded-2xl" />
      <Bar className="mb-4 h-64 w-full rounded-2xl" />
      <Bar className="h-12 w-full rounded-full" />
    </SkeletonShell>
  );
}
