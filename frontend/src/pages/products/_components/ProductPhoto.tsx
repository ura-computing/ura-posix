/** A product photo (web address from the scraped shops), or the box icon when there is none
 *  or it no longer loads (`Thumbnail`). Give it `key={src}`. */
import { Package } from "lucide-react";

import { Thumbnail } from "@/_components/molecules/Thumbnail";
import { useT } from "@/i18n/I18nProvider";

export function ProductPhoto({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const t = useT();
  return <Thumbnail src={src} alt={name} icon={Package} label={t("products.noPhoto")} className={className} />;
}
