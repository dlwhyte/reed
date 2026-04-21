import { clsx } from "clsx";

type Density = "mixed" | "cards" | "list";

/**
 * Paper-toned loading placeholders that mirror the card layout the Library
 * will show once data arrives. Keeps the reading rhythm intact while the
 * shelf materializes.
 */
export function LibrarySkeleton({ density }: { density: Density }) {
  const bar = "bg-rule/70 animate-pulse rounded-md";
  const cover = "bg-rule/50 animate-pulse rounded-md";

  if (density === "cards") {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} bar={bar} cover={cover} />
        ))}
      </div>
    );
  }

  if (density === "list") {
    return (
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} bar={bar} />
        ))}
      </div>
    );
  }

  return (
    <>
      <SkeletonHero bar={bar} cover={cover} />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SkeletonCard bar={bar} cover={cover} />
        <SkeletonCard bar={bar} cover={cover} />
      </div>
      <div className="mt-8 space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonRow key={i} bar={bar} />
        ))}
      </div>
    </>
  );
}

function SkeletonHero({ bar, cover }: { bar: string; cover: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 rounded-xl border border-rule bg-paper-raised p-5 md:grid-cols-[1.1fr_1.3fr] md:p-6">
      <div className={clsx(cover, "h-[240px] w-full")} />
      <div className="flex flex-col gap-3 pt-2">
        <div className={clsx(bar, "h-3 w-32")} />
        <div className="space-y-2">
          <div className={clsx(bar, "h-6 w-[92%]")} />
          <div className={clsx(bar, "h-6 w-3/4")} />
        </div>
        <div className={clsx(bar, "h-3 w-48")} />
        <div className="space-y-1.5 pt-2">
          <div className={clsx(bar, "h-3 w-full")} />
          <div className={clsx(bar, "h-3 w-[85%]")} />
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ bar, cover }: { bar: string; cover: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-rule bg-paper-raised">
      <div className={clsx(cover, "h-[120px] w-full rounded-none")} />
      <div className="flex flex-col gap-2 p-4">
        <div className={clsx(bar, "h-2.5 w-28")} />
        <div className={clsx(bar, "h-4 w-[90%]")} />
        <div className={clsx(bar, "h-4 w-2/3")} />
        <div className={clsx(bar, "h-3 w-full mt-1")} />
      </div>
    </div>
  );
}

function SkeletonRow({ bar }: { bar: string }) {
  return (
    <div className="flex items-start gap-5 border-b border-dashed border-rule py-4">
      <div className={clsx(bar, "mt-1 h-2.5 w-10")} />
      <div className="flex-1 space-y-2">
        <div className={clsx(bar, "h-2.5 w-40")} />
        <div className={clsx(bar, "h-4 w-[85%]")} />
        <div className={clsx(bar, "h-3 w-3/5")} />
      </div>
    </div>
  );
}
