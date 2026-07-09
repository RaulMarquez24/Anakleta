import { SkeletonShell, Bar } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonShell back>
      <Bar className="mb-4 h-4 w-2/3" />
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex gap-2">
          <Bar className="h-10 flex-1 rounded-full" />
          <Bar className="h-10 flex-1 rounded-full" />
        </div>
        <Bar className="h-11 w-full rounded-xl" />
        <Bar className="h-11 w-full rounded-full" />
      </div>
    </SkeletonShell>
  );
}
