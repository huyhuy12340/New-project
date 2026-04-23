/* eslint-disable @next/next/no-img-element */

type ThumbnailCompareProps = {
  beforeLabel: string;
  afterLabel: string;
  beforeSrc?: string;
  afterSrc?: string;
};

function ThumbnailPanel({
  label,
  src,
}: {
  label: string;
  src?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="border-b border-border px-4 py-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </div>
      {src ? (
        <img
          alt={label}
          className="h-72 w-full object-cover"
          loading="lazy"
          src={src}
        />
      ) : (
        <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Thumbnail placeholder
        </div>
      )}
    </div>
  );
}

export function ThumbnailCompare({
  beforeLabel,
  afterLabel,
  beforeSrc,
  afterSrc,
}: ThumbnailCompareProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ThumbnailPanel label={beforeLabel} src={beforeSrc} />
      <ThumbnailPanel label={afterLabel} src={afterSrc} />
    </div>
  );
}
