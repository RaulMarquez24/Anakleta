import { SkeletonShell, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell>
      <Bar className="mb-5 h-40 w-full rounded-2xl" />
      <Bar className="mb-4 h-44 w-full rounded-2xl" />
      <Bar className="h-52 w-full rounded-2xl" />
    </SkeletonShell>
  );
}
