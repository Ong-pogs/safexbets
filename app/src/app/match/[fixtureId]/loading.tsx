/** Route-level skeleton while the replay resolves server-side — mirrors the Match Center grid. */
export default function MatchLoading() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6" aria-busy="true">
      <div className="h-7 w-32 animate-pulse rounded-lg bg-white/5" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel h-24 animate-pulse opacity-60" />
          <div className="panel aspect-video animate-pulse opacity-60" />
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="panel h-64 animate-pulse opacity-60" />
            <div className="panel h-64 animate-pulse opacity-60" />
          </div>
        </div>
        <div className="panel h-80 animate-pulse opacity-60" />
      </div>
      <p className="led text-center text-[10px] tracking-[0.2em] text-mist">
        LOADING MATCH CENTER…
      </p>
    </main>
  );
}
