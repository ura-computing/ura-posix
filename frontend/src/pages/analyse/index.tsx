/** /analyses — Analyse de marge with 8 modes + Liste CSV upload.
 *
 *  Mode picker: horizontal scrollable tab strip (ModeTabs).
 *  Filter bar: date range + category segment + search + Exporter Excel right action.
 *  KPI strip: 4 KpiTile (CA / Marge % / Marge DH / Optimisation gauge).
 *  Body: per-mode table OR (Liste mode) upload card + table.
 */
import { Download } from "lucide-react";

import { CATEGORY_TYPE_OPTIONS } from "@/components/shared/CategorySegment";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { ModeTabs } from "@/components/shared/ModeTabs";
import { MARGE_MODES, MARGE_MODE_LABELS } from "@/types";
import type { AnalyseFilters, MargeMode } from "@/types";

import { AnalyseKpis } from "./_components/AnalyseKpis";
import { AnalyseTable } from "./_components/AnalyseTable";
import { ListeUploadCard } from "./_components/ListeUploadCard";
import { useAnalysePage } from "./_hooks/useAnalysePage";


const MODE_OPTIONS = MARGE_MODES.map((value) => ({ value, label: MARGE_MODE_LABELS[value] }));


const CATEGORY_LABEL: Record<string, string> = {
  all: "Mixte", pharmacie: "Pharmacie", parapharmacie: "Parapharmacie",
};


function buildActiveFilters(
  filters: AnalyseFilters,
  setFilters: (f: AnalyseFilters) => void,
): ActiveFilter[] {
  return [
    (filters.date_from || filters.date_to) && {
      key: "dates",
      label: <>Période : {filters.date_from ?? "…"} → {filters.date_to ?? "…"}</>,
      onClear: () => setFilters({ ...filters, date_from: null, date_to: null }),
    },
    filters.category_type !== "all" && {
      key: "category",
      label: <>Catégorie : {CATEGORY_LABEL[filters.category_type]}</>,
      onClear: () => setFilters({ ...filters, category_type: "all" }),
    },
  ].filter(Boolean) as ActiveFilter[];
}


export default function AnalysePage() {
  const s = useAnalysePage();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analyse de marge</h1>
        <p className="text-sm text-muted-foreground">
          8 axes d'analyse — produit, catégorie, laboratoire, grossiste, client, mois, année, liste personnalisée.
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
          options:  CATEGORY_TYPE_OPTIONS,
        }}
        search={{
          value:       s.search,
          onChange:    s.setSearch,
          placeholder: "Rechercher dans les résultats…",
          suggestions: s.suggestions,
          onPick:      (label) => s.setSearch(label),
        }}
        rightActions={[
          {
            label:    "Exporter Excel",
            icon:     <Download className="size-4" />,
            variant:  "outline",
            onClick:  s.handleExport,
            disabled: s.rows.length === 0,
          },
        ]}
        activeFilters={buildActiveFilters(s.filters, s.setFilters)}
        onResetAll={s.clearAll}
      />

      <ModeTabs<MargeMode>
        value={s.mode}
        options={MODE_OPTIONS}
        onChange={s.setMode}
      />

      <AnalyseKpis kpis={s.kpis} isLoading={s.isLoading} />

      {/* Liste mode: upload card on top. After submit, the table renders below. */}
      {s.mode === "liste" && (
        <ListeUploadCard
          onSubmit={s.submitListe}
          isLoading={s.isLoading}
          submitted={s.listeSubmitted}
        />
      )}

      {/* Table: shows for all 8 modes (Liste shows it once items are submitted). */}
      {(s.mode !== "liste" || s.listeSubmitted) && (
        <AnalyseTable mode={s.mode} rows={s.rows} loading={s.isLoading} pagination={s.pagination} />
      )}

      {s.error && (
        <div className="rounded-md border border-error/40 bg-error-subtle px-4 py-3 text-sm text-error">
          {/* Surface the API detail when available — a bare "réessayez" hid real causes (e.g. 422). */}
          Impossible de charger l'analyse.{" "}
          {s.error instanceof Error && s.error.message
            ? s.error.message
            : "Réessayez plus tard."}
        </div>
      )}
    </div>
  );
}
