/** The store as a customer sees it, inside the editor: the public preview page in a frame, on a computer or a phone
 *  width, page by page. `version` changes after each save → the frame reloads with the saved state. */
import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { buttonClass } from "@/_components/atoms/buttonClass";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { Segmented } from "@/_components/molecules/Segmented";
import { useT } from "@/i18n/I18nProvider";
import type { StoreTemplate } from "@/types/storeWebsite";
import { cn } from "@/utils/cn";

import { previewPath } from "../../paths";

type Page = "home" | "catalogue" | "contact";
type Device = "desktop" | "phone";

export function StorePreview({
  requestId,
  template,
  version,
}: {
  requestId: string;
  template: StoreTemplate;
  version: string;
}) {
  const t = useT();
  const [page, setPage] = useState<Page>("home");
  const [device, setDevice] = useState<Device>("desktop");
  const src = previewPath(template, page, requestId);

  return (
    <SectionCard
      title={t("store.previewTitle")}
      actions={
        <a href={src} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm")}>
          <ExternalLink className="size-3.5" />
          {t("store.openPreview")}
        </a>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Page>
          value={page}
          onChange={setPage}
          options={[
            { value: "home", label: t("store.pageHome") },
            { value: "catalogue", label: t("store.pageCatalogue") },
            { value: "contact", label: t("store.pageContact") },
          ]}
        />
        <Segmented<Device>
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: t("store.deviceComputer") },
            { value: "phone", label: t("store.devicePhone") },
          ]}
        />
      </div>
      <div className="flex justify-center rounded-lg bg-surface-subtle p-3">
        <iframe
          key={`${src}|${version}`}
          src={src}
          title={t("store.previewTitle")}
          className={cn(
            "h-[720px] rounded-lg border border-border bg-white shadow-sm",
            device === "phone" ? "w-[390px] max-w-full" : "w-full",
          )}
        />
      </div>
    </SectionCard>
  );
}
