/** The product's photos: a big one + small ones to pick from (when there are several). */
import { useState } from "react";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

import { ProductPhoto } from "../../_components/ProductPhoto";

export function PhotoGallery({ images, name }: { images: string[]; name: string }) {
  const t = useT();
  const [picked, setPicked] = useState(0);
  const shown = images[picked] ?? images[0] ?? null;
  return (
    <div className="flex flex-col items-center gap-3">
      <ProductPhoto key={shown} src={shown} name={name} className="aspect-square w-full max-w-[260px]" />
      {images.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t("products.photos")}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setPicked(i)}
              aria-label={t("products.photoN", { n: i + 1 })}
              aria-pressed={i === picked}
              className={cn(
                "cursor-pointer rounded-md p-0.5 transition-colors",
                i === picked ? "ring-2 ring-primary" : "ring-1 ring-transparent hover:ring-border",
              )}
            >
              <ProductPhoto key={src} src={src} name={name} className="size-14" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
