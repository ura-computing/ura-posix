/** /analyses — Analyse de marge with 8 modes + Liste CSV upload.
 *
 *  Mode picker: horizontal scrollable tab strip (ModeTabs).
 *  Filter bar: date range + category segment + search + Exporter Excel, plus an
 *  "Importer une liste" action in Liste mode (right of Export).
 *  KPI strip: 4 KpiTile (CA / Marge % / Marge DH / Optimisation gauge).
 *  Body: per-mode table (Liste mode: slim import status line, then the table).
 */
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";

import { useCategoryTypeOptions } from "@/components/shared/CategorySegment";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { FilterBar, type ActiveFilter, type RightAction } from "@/components/shared/filterBar";
import { ModeTabs } from "@/components/shared/ModeTabs";
import { MARGE_MODES } from "@/types";
import type { AnalyseFilters, MargeMode } from "@/types";

import { AnalyseKpis } from "./_components/AnalyseKpis";
import { AnalyseTable } from "./_components/AnalyseTable";
import { parseCsv } from "./_utils/parseListeCsv";
import { useAnalysePage } from "./_hooks/useAnalysePage";





const CATEGORY_KEY: Record<string, string> = {
  all: "category.mixte", pharmacie: "category.pharmacie", parapharmacie: "category.parapharmacie",
};


function buildActiveFilters(
  filters: AnalyseFilters,
  setFilters: (f: AnalyseFilters) => void,
  t: TFn,
): ActiveFilter[] {
  return [
    (filters.date_from || filters.date_to) && {
      key: "dates",
      label: <>{t("dashboard.periode")} {filters.date_from ?? "…"} → {filters.date_to ?? "…"}</>,
      onClear: () => setFilters({ ...filters, date_from: null, date_to: null }),
    },
    filters.category_type !== "all" && {
      key: "category",
      label: <>{t("dashboard.categorieFilter")} {t(CATEGORY_KEY[filters.category_type])}</>,
      onClear: () => setFilters({ ...filters, category_type: "all" }),
    },
  ].filter(Boolean) as ActiveFilter[];
}


export default function AnalysePage() {
  const t = useT();
  const s = useAnalysePage();
  const categoryTypeOptions = useCategoryTypeOptions();
  const MODE_OPTIONS = MARGE_MODES.map((value) => ({ value, label: t(`mode.${value}`) }));

  // Liste import moved into the FilterBar (right of "Exporter Excel"). The hidden
  // file input + a slim status line replace the old upload card.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listeFile,  setListeFile]  = useState<string | null>(null);
  const [listeCount, setListeCount] = useState<number>(0);
  const [listeError, setListeError] = useState<string | null>(null);

  function handleListeFile(file: File) {
    setListeError(null);
    setListeFile(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = parseCsv(String(reader.result ?? ""));
        if (items.length === 0) {
          setListeCount(0);
          setListeError(t("analyse.noProductDetected"));
          return;
        }
        setListeCount(items.length);
        s.submitListe(items);
      } catch {
        setListeCount(0);
        setListeError(t("analyse.csvReadError"));
      }
    };
    reader.onerror = () => setListeError(t("analyse.fileReadError"));
    reader.readAsText(file);
  }

  const rightActions: RightAction[] = [
    {
      label:    t("common.export"),
      icon:     <Download className="size-4" />,
      variant:  "outline",
      onClick:  s.handleExport,
      disabled: s.rows.length === 0,
    },
    // Import lives here only in Liste mode — to the right of Exporter Excel.
    ...(s.mode === "liste" ? [{
      label:    s.isLoading ? t("analyse.analyseLoading") : t("analyse.importListe"),
      icon:     <Upload className="size-4" />,
      variant:  "primary" as const,
      onClick:  () => fileInputRef.current?.click(),
      disabled: s.isLoading,
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("analyse.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("analyse.subtitle")}
        </p>
      </header>

      <FilterBar<string>
        dateRange={{
          from:     s.filters.date_from,
          to:       s.filters.date_to,
          onChange: (from, to) => s.setFilters({ ...s.filters, date_from: from, date_to: to }),
        }}
        segment={{
          value:    s.filters.category_type,
          onChange: (v) => s.setFilters({ ...s.filters, category_type: v }),
          options:  categoryTypeOptions,
        }}
        search={{
          value:       s.search,
          onChange:    s.setSearch,
          placeholder: t("analyse.searchPh"),
          suggestions: s.suggestions,
          onPick:      (label) => s.setSearch(label),
        }}
        rightActions={rightActions}
        activeFilters={buildActiveFilters(s.filters, s.setFilters, t)}
        onResetAll={s.clearAll}
      />

      {/* Liste mode: hidden file input (triggered by the top-bar "Importer"
          button) + a slim status line — replaces the old upload card. */}
      {s.mode === "liste" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleListeFile(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <p className="text-sm text-muted-foreground">
            {listeError ? (
              <span className="font-semibold text-error">{listeError}</span>
            ) : listeFile ? (
              <>
                <span className="font-medium text-foreground">{listeFile}</span>
                {listeCount > 0 && <> · {listeCount} {t("stock.produitsWord")}</>}
              </>
            ) : (
              t("analyse.listeHint")
            )}
          </p>
        </>
      )}

      <ModeTabs<MargeMode>
        value={s.mode}
        options={MODE_OPTIONS}
        onChange={s.setMode}
      />

      <AnalyseKpis kpis={s.kpis} isLoading={s.isLoading} />

      {/* Table: shows for all 8 modes (Liste shows it once items are submitted). */}
      {(s.mode !== "liste" || s.listeSubmitted) && (
        <AnalyseTable
          mode={s.mode}
          rows={s.rows}
          loading={s.isLoading}
          pagination={s.pagination}
          sortBy={s.sortBy}
          sortOrder={s.sortOrder}
          onSort={s.toggleSort}
        />
      )}

      {s.error && (
        <div className="rounded-md border border-error/40 bg-error-subtle px-4 py-3 text-sm text-error">
          {/* Surface the API detail when available — a bare "réessayez" hid real causes (e.g. 422). */}
          {t("analyse.loadError")}{" "}
          {s.error instanceof Error && s.error.message
            ? s.error.message
            : t("analyse.retryLater")}
        </div>
      )}
    </div>
  );
}
