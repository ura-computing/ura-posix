/** Top of the Catalogue: how many products, by type, how many still to classify (a click filters the list), and the
 *  last Sobrus import (running: products added so far). Same tiles as Analyses (`KpiTile`). */
import { BookOpen, CloudDownload, HelpCircle, Pill, Sparkles } from "lucide-react";

import { SkeletonTile } from "@/_components/molecules/Skeletons";
import { KpiTile } from "@/_components/organisms/KpiTile";
import { useAdminSobrusImport } from "@/hooks/sharedQueries";
import type { ProductType } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { formatDateTime, formatNumStr } from "@/utils/format";
import { runResult } from "@/utils/sobrus";

import { useCatalogStats } from "../hooks";

export function CatalogStatsTiles({
  onFilterType,
}: {
  /** A type tile clicked: the list filtered on it. */
  onFilterType: (type: ProductType | "unclassified" | null) => void;
}) {
  const t = useT();
  const { stats } = useCatalogStats();
  const { sobrusImport } = useAdminSobrusImport();
  const last = sobrusImport?.runs.at(-1)?.run ?? null;
  const running = last != null && (last.status === "queued" || last.status === "running");
  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiTile
        label={t("catalogue.statTotal")}
        value={formatNumStr(stats.total)}
        icon={<BookOpen className="size-5" />}
        iconTone="primary"
        onClick={() => onFilterType(null)}
      />
      <KpiTile
        label={t("catalogue.pharmacie")}
        value={formatNumStr(stats.pharmacie)}
        icon={<Pill className="size-5" />}
        iconTone="emerald"
        onClick={() => onFilterType("pharmacie")}
      />
      <KpiTile
        label={t("catalogue.parapharmacie")}
        value={formatNumStr(stats.parapharmacie)}
        icon={<Sparkles className="size-5" />}
        iconTone="info"
        onClick={() => onFilterType("parapharmacie")}
      />
      <KpiTile
        label={t("catalogue.nonClasses")}
        value={formatNumStr(stats.unclassified)}
        sub={stats.unclassified > 0 ? t("catalogue.statToClassify") : undefined}
        subTone={stats.unclassified > 0 ? "warning" : undefined}
        icon={<HelpCircle className="size-5" />}
        iconTone={stats.unclassified > 0 ? "warning" : "slate"}
        onClick={() => onFilterType("unclassified")}
      />
      <KpiTile
        label={t("catalogue.statLastSobrus")}
        value={last == null ? "—" : formatNumStr(last.lines_added)}
        sub={
          last == null
            ? t("catalogue.statNever")
            : running
              ? t("catalogue.statRunning", { page: formatNumStr(last.chunk_current) })
              : `${formatDateTime(last.ended_at)} · ${runResult(t, last)}`
        }
        subTone={last?.status === "error" ? "error" : running ? "primary" : undefined}
        icon={<CloudDownload className="size-5" />}
        iconTone="slate"
      />
    </div>
  );
}
