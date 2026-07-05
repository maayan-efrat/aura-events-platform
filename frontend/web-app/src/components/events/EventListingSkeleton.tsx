export function EventListingSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <li key={index} className="list-none animate-pulse overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="aspect-[16/9] w-full bg-surface-muted" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-5 w-2/3 rounded-full bg-surface-muted" />
            <div className="h-4 w-full rounded-full bg-surface-muted" />
            <div className="h-4 w-4/5 rounded-full bg-surface-muted" />
            <div className="mt-2 flex items-center justify-between">
              <div className="h-4 w-1/3 rounded-full bg-surface-muted" />
              <div className="h-4 w-1/4 rounded-full bg-surface-muted" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
