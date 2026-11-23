/** A picture in a bordered frame (white behind it: pictures are shot on white, also in dark mode), or an icon when
 *  there is none or it no longer loads: a product photo, a store's logo. Give it `key={src}`: a new address starts
 *  « not broken » again.
 *
 *    <Thumbnail src={logoUrl} alt="Logo" icon={Store} label="Pas de logo" className="size-14 rounded-xl p-1" /> */
import { useState, type ComponentType } from "react";

import { cn } from "@/utils/cn";

const FRAME = "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border";

export function Thumbnail({
  src,
  alt,
  icon: Icon,
  label,
  className,
}: {
  src: string | null;
  alt: string;
  /** Shown when there is no picture. */
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Read out when there is no picture. */
  label: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span role="img" aria-label={label} className={cn(FRAME, "bg-surface-subtle", className)}>
        <Icon className="size-1/2 text-muted-foreground" aria-hidden />
      </span>
    );
  }
  return (
    <span className={cn(FRAME, "bg-white", className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-full object-contain"
      />
    </span>
  );
}
