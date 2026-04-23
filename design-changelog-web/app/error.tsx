"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col items-start justify-center gap-4 px-4 py-10 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-destructive">Something went wrong</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          We could not render this view.
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
      >
        Try again
      </button>
    </main>
  )
}
