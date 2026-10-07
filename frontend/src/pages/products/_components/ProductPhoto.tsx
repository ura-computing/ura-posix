/** A product photo (web address from the scraped shops), or the box icon when there is none
 *  or it no longer loads. Give it `key={src}`: a new address starts « not broken » again. */
import { useState } from "react";
import { Package } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

const FRAME = "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border";

export function ProductPhoto({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const t = useT();
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span role="img" aria-label={t("products.noPhoto")} className={cn(FRAME, "bg-surface-subtle", className)}>
        <Package className="size-1/2 text-muted-foreground" aria-hidden />
      </span>
    );
  }
  // White frame: shop photos are shot on white, also in dark mode.
  return (
    <span className={cn(FRAME, "bg-white", className)}>
      <img
        src={src}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="size-full object-contain"
      />
    </span>
  );
}
