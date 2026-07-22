import { ArrowLeft, Boxes, CheckCircle2, ChevronRight, FileSpreadsheet, ShoppingBasket, ShoppingCart, UploadCloud } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { ROLES } from "@/types";
import type { DocType, Feature } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { DropZone }     from "./_components/DropZone";
import { ImportState }  from "./_components/ImportState";
import { PreviewTable } from "./_components/PreviewTable";
import { Stepper }      from "./_components/Stepper";
import { TypeCard }     from "./_components/TypeCard";
import { useUpload }    from "./_hooks/useUpload";


/**
 * Upload-file 3-step wizard. Type → Drag-drop → Preview + import.
 *
 * Query-param deep link: ?type=achat|vente|stock skips to step 2 with that
 * doc-type preselected. Used by the Stock CTA on /rapport (?type=stock).
 */

const buildTypeMeta = (t: TFn) => ({
  achat: {
    title:       t("uploadFile.achatTitle"),
    description: t("uploadFile.achatDesc"),
    icon:        ShoppingCart,
    columns:     ["PID", t("col.produit"), t("col.reference"), t("col.fournisseur"), t("uploadFile.quantite"), t("uploadFile.prixUnitaire"), t("col.total"), t("col.dateBL"), t("col.peremption")],
  },
  vente: {
    title:       t("uploadFile.venteTitle"),
    description: t("uploadFile.venteDesc"),
    icon:        ShoppingBasket,
    columns:     ["PID", t("col.produit"), t("col.date"), t("col.transaction"), t("col.client"), t("uploadFile.quantite"), t("col.remise"), t("uploadFile.prixUnitaire")],
  },
  stock: {
    title:       t("uploadFile.stockTitle"),
    description: t("uploadFile.stockDesc"),
    icon:        Boxes,
    columns:     ["PID", t("col.produit"), t("col.stock"), t("stock.stockMin"), t("stock.stockMax"), t("col.peremption"), t("uploadFile.zone"), t("col.categorie"), "PPV", "PPH", "TVA"],
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

  const u = useUpload(typeFromUrl);
  const { pickType } = u;

  // Card-click handler: pick the type AND mirror it into ?type=... so the URL
  // stays a shareable deep-link to the active step. `replace: true` avoids
  // polluting the browser back-stack with every card toggle.
  const handlePickType = (dt: DocType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", dt);
      return next;
    }, { replace: true });
    pickType(dt);
  };

  // Back-to-step-1 also clears ?type= so the URL doesn't lie about the
  // active step. Pairs with handlePickType to keep URL ↔ wizard in sync.
  const handleBackToType = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("type");
      return next;
    }, { replace: true });
    u.backToType();
  };

  const { me } = useMe();
  const allowedTypes = useMemo<DocType[]>(() => {
    const all: DocType[] = ["achat", "vente", "stock"];
    if (me?.role === ROLES.ADMIN) return all;          // admin bypass
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileSpreadsheet className="size-5" aria-hidden />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t("uploadFile.pageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("uploadFile.pageDesc")}
          </p>
        </div>
      </header>

      <Stepper current={u.step} />

      {/* ─── STEP 1 — Type ─── */}
      {u.step === 1 && (
        <section className="flex flex-col gap-4">
          {allowedTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("uploadFile.noTypeAvailable")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                    selected={u.docType === dt}
                    onSelect={() => handlePickType(dt)}
                  />
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => u.docType && handlePickType(u.docType)}
              disabled={!u.docType}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("uploadFile.continue")}
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>
      )}

      {/* ─── STEP 2 — File ─── */}
      {u.step === 2 && u.docType && (
        <section className="flex flex-col gap-4">
          <button
            type="button"
            onClick={handleBackToType}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("uploadFile.changeType")}
          </button>
          <DropZone
            docType={u.docType}
            example={u.examples[u.docType]}
            onAccept={(f) => u.acceptFile(f, u.docType!)}
            errorMsg={u.filenameError}
            onClearError={() => { /* setting state is internal to useUpload; clearing on next accept attempt */ }}
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
      {u.step === 3 && u.docType && (
        <section className="flex flex-col gap-4">
          {(u.file || u.phase !== "idle") && (
            <button
              type="button"
              onClick={u.file ? u.changeFile : u.reset}
              className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {u.file ? t("uploadFile.chooseAnother") : t("uploadFile.newImport")}
            </button>
          )}

          {u.file && u.phase === "idle" ? (
            <>
              <PreviewTable
                headers={u.headers}
                rows={u.previewRows}
                totalRows={u.totalRows}
                filename={u.file.name}
                fileDates={u.fileDates}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={u.startImport}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <UploadCloud className="size-4" />
                  {t("uploadFile.importToDb")}
                </button>
              </div>
            </>
          ) : u.phase !== "idle" ? (
            <ImportState
              docType={u.docType}
              phase={u.phase}
              progress={u.progress}
              error={u.error}
              filename={u.filename ?? u.file?.name ?? null}
              stockResult={u.stockResult}
              onCancel={u.cancel}
              onReset={u.reset}
            />
          ) : (
            <ImportDoneFallback docType={u.docType} onNewImport={u.reset} />
          )}
        </section>
      )}
    </div>
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
        style={{ background: `color-mix(in srgb, var(--color-doc-${docType}) 15%, transparent)`, color: `var(--color-doc-${docType})` }}
      >
        <CheckCircle2 className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground">{t("uploadFile.done")}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("uploadFile.doneDesc")}
      </p>
      <button
        type="button"
        onClick={onNewImport}
        className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        <UploadCloud className="size-4" />
        {t("uploadFile.newImport")}
      </button>
    </div>
  );
}