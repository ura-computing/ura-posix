import { ArrowLeft, Boxes, CheckCircle2, ChevronRight, ShoppingBasket, ShoppingCart, UploadCloud } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMe } from "@/hooks/useMe";
import { ROLES, type Role } from "@/types";
import type { DocType, Feature } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { useUpload } from "./hooks";
import { Stepper } from "@/_components/molecules/Stepper";
import { Page } from "@/_components/templates/Page";
import { Button } from "@/_components/atoms/Button";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { ImportState } from "./_components/ImportState";
import { DropZone } from "./_components/DropZone";
import { PickedFiles } from "./_components/PickedFiles";
import { BatchFiles } from "./_components/BatchFiles";
import { PreviewTable } from "./_components/PreviewTable";
import { TypeCard } from "./_components/TypeCard";

/**
 * Upload-file 3-step wizard. Type → Drag-drop → Preview + import.
 *
 * Query-param deep link: ?type=achat|vente|stock skips to step 2 with that
 * doc-type preselected. Used by the Stock CTA on /rapport (?type=stock).
 */

const buildTypeMeta = (t: TFn) =>
  ({
    achat: {
      title: t("uploadFile.achatTitle"),
      description: t("uploadFile.achatDesc"),
      icon: ShoppingCart,
      columns: [
        "PID",
        t("col.produit"),
        t("col.reference"),
        t("col.fournisseur"),
        t("uploadFile.quantite"),
        t("uploadFile.prixUnitaire"),
        t("col.total"),
        t("col.dateBL"),
        t("col.peremption"),
      ],
    },
    vente: {
      title: t("uploadFile.venteTitle"),
      description: t("uploadFile.venteDesc"),
      icon: ShoppingBasket,
      columns: [
        "PID",
        t("col.produit"),
        t("col.date"),
        t("col.transaction"),
        t("col.client"),
        t("uploadFile.quantite"),
        t("col.remise"),
        t("uploadFile.prixUnitaire"),
      ],
    },
    stock: {
      title: t("uploadFile.stockTitle"),
      description: t("uploadFile.stockDesc"),
      icon: Boxes,
      columns: [
        "PID",
        t("col.produit"),
        t("col.stock"),
        t("stock.stockMin"),
        t("stock.stockMax"),
        t("col.peremption"),
        t("uploadFile.zone"),
        t("col.categorie"),
        "PPV",
        "PPH",
        "TVA",
      ],
    },
  }) satisfies Record<DocType, { title: string; description: string; icon: typeof Boxes; columns: string[] }>;

/** Which per-type feature gates each DocType. The upload endpoint requires
 *  BOTH `import` AND the doc-type feature, so the picker must hide types
 *  the caller can't actually submit. */
const TYPE_FEATURE: Record<DocType, Feature> = {
  achat: "achats",
  vente: "ventes",
  stock: "stock",
};

export default function UploadFilePage() {
  const t = useT();
  const typeMeta = buildTypeMeta(t);
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFromUrl = parseTypeParam(searchParams.get("type"));

  const {
    acceptFiles,
    batchJobs,
    cancelBatch,
    picked,
    startImportAll,
    pickType,
    backToType,
    cancel,
    changeFile,
    clearFilenameError,
    docType,
    error,
    examples,
    file,
    fileDates,
    filename,
    filenameError,
    headers,
    phase,
    previewRows,
    progress,
    reset,
    startImport,
    step,
    stockResult,
    totalRows,
  } = useUpload(typeFromUrl);

  // Card-click handler: pick the type AND mirror it into ?type=... so the URL
  // stays a shareable deep-link to the active step. `replace: true` avoids
  // polluting the browser back-stack with every card toggle.
  const handlePickType = (dt: DocType) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("type", dt);
        return next;
      },
      { replace: true },
    );
    pickType(dt);
  };

  // Back-to-step-1 also clears ?type= so the URL doesn't lie about the
  // active step. Pairs with handlePickType to keep URL ↔ wizard in sync.
  const handleBackToType = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("type");
        return next;
      },
      { replace: true },
    );
    backToType();
  };

  const { me } = useMe();
  const allowedTypes = useMemo<DocType[]>(() => {
    const all: DocType[] = ["achat", "vente", "stock"];
    if (([ROLES.ADMIN, ROLES.SUPPORT] as (Role | undefined)[]).includes(me?.role)) return all; // admin / Support: every type
    return all.filter((dt) => me?.permissions.includes(TYPE_FEATURE[dt]));
  }, [me]);

  // Re-sync when the ?type=... param changes (user navigates from another tab card).
  // `pickType` is useCallback'd with [] in useUpload, so its identity is stable —
  // the effect only re-fires on real URL changes. Idempotent: setting the same
  // docType twice is a no-op (React bails on identical state).
  useEffect(() => {
    if (typeFromUrl) pickType(typeFromUrl);
  }, [typeFromUrl, pickType]);

  return (
    <Page title={t("uploadFile.pageTitle")} subtitle={t("uploadFile.pageDesc")} narrow>
      <Stepper steps={[t("uploadFile.step1"), t("uploadFile.step2"), t("uploadFile.step3")]} current={step - 1} />

      {/* ─── STEP 1 — Type ─── */}
      {step === 1 && (
        <section className="flex flex-col gap-4">
          {allowedTypes.length === 0 ? (
            <EmptyState title={t("uploadFile.noTypeAvailable")} />
          ) : (
            <div role="radiogroup" aria-label={t("uploadFile.step1")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {allowedTypes.map((dt) => {
                const meta = typeMeta[dt];
                const Icon = meta.icon;
                return (
                  <TypeCard
                    key={dt}
                    type={dt}
                    title={meta.title}
                    description={meta.description}
                    icon={<Icon className="size-5" />}
                    columns={meta.columns}
                    totalCols={meta.columns.length}
                    selected={docType === dt}
                    onSelect={() => handlePickType(dt)}
                  />
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => docType && handlePickType(docType)} disabled={!docType}>
              {t("uploadFile.continue")}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      )}

      {/* ─── STEP 2 — File ─── */}
      {step === 2 && docType && (
        <section className="flex flex-col gap-4">
          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={handleBackToType}>
            <ArrowLeft className="size-3.5" />
            {t("uploadFile.changeType")}
          </Button>
          <DropZone
            docType={docType}
            example={examples[docType]}
            multiple={docType !== "stock"}
            onAccept={(files) => acceptFiles(files, docType!)}
            errorMsg={filenameError}
            onClearError={clearFilenameError}
          />
        </section>
      )}

      {/* ─── STEP 3 — Preview + import + state cards ─────────────────────
           Three mutually-exclusive states, and it must NEVER render empty:
            • file + idle   → preview table + "Importer" button
            • active job    → the matching state card (queued/running/…/success)
            • else (no file, no job) → the success card auto-dismissed (4s) and
              left us parked on step 3 → show a persistent "Import terminé"
              confirmation instead of a blank page.
      */}
      {step === 3 && docType && (
        <section className="flex flex-col gap-4">
          {batchJobs.length === 0 && (file || picked.length > 0 || phase !== "idle") && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={file || picked.length > 0 ? changeFile : reset}
            >
              <ArrowLeft className="size-3.5" />
              {picked.length > 0
                ? t("uploadFile.chooseOthers")
                : file
                  ? t("uploadFile.chooseAnother")
                  : t("uploadFile.newImport")}
            </Button>
          )}

          {batchJobs.length > 0 ? (
            <BatchFiles jobs={batchJobs} onCancel={cancelBatch} onNewImport={reset} />
          ) : picked.length > 0 ? (
            <PickedFiles files={picked} onImport={startImportAll} />
          ) : file && phase === "idle" ? (
            <>
              <PreviewTable
                headers={headers}
                rows={previewRows}
                totalRows={totalRows}
                filename={file.name}
                fileDates={fileDates}
              />
              <div className="flex justify-end">
                <Button onClick={startImport}>
                  <UploadCloud className="size-4" />
                  {t("uploadFile.importToDb")}
                </Button>
              </div>
            </>
          ) : phase !== "idle" ? (
            <ImportState
              docType={docType}
              phase={phase}
              progress={progress}
              error={error}
              filename={filename ?? file?.name ?? null}
              stockResult={stockResult}
              onCancel={cancel}
              onReset={reset}
            />
          ) : (
            <ImportDoneFallback docType={docType} onNewImport={reset} />
          )}
        </section>
      )}
    </Page>
  );
}

function parseTypeParam(s: string | null): DocType | null {
  if (s === "achat" || s === "vente" || s === "stock") return s;
  return null;
}

/** Shown on step 3 once the detailed success card has auto-dismissed (4 s) but
 *  the wizard is still parked on step 3 with no file — previously a blank page.
 *  Reaching this state always means an import just succeeded (only "success"
 *  jobs auto-dismiss), so a completion confirmation is safe and accurate. */
function ImportDoneFallback({ docType, onNewImport }: { docType: DocType; onNewImport: () => void }) {
  const t = useT();
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border p-8 text-center"
      style={{ borderColor: `var(--color-doc-${docType}-border)`, background: `var(--color-doc-${docType}-bg)` }}
    >
      <div
        className="flex size-12 items-center justify-center rounded-full"
        style={{
          background: `color-mix(in srgb, var(--color-doc-${docType}) 15%, transparent)`,
          color: `var(--color-doc-${docType})`,
        }}
      >
        <CheckCircle2 className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground">{t("uploadFile.done")}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{t("uploadFile.doneDesc")}</p>
      <Button className="mt-1" onClick={onNewImport}>
        <UploadCloud className="size-4" />
        {t("uploadFile.newImport")}
      </Button>
    </div>
  );
}
