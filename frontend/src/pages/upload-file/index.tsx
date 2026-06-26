import { ArrowLeft, Boxes, ChevronRight, FileSpreadsheet, ShoppingBasket, ShoppingCart, UploadCloud } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { ROLES } from "@/types";
import type { DocType, Feature } from "@/types";

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

const TYPE_META = {
  achat: {
    title:       "Achats",
    description: "Bons de livraison fournisseurs",
    icon:        ShoppingCart,
    columns:     ["PID", "Produit", "Référence", "Fournisseur", "Quantité", "Prix unitaire", "Total", "Date BL", "Péremption"],
  },
  vente: {
    title:       "Ventes",
    description: "Transactions de vente clients",
    icon:        ShoppingBasket,
    columns:     ["PID", "Produit", "Date", "N° transaction", "Client", "Quantité", "Remise", "Prix unitaire"],
  },
  stock: {
    title:       "Stock",
    description: "Photo du stock courant — met à jour les médicaments existants",
    icon:        Boxes,
    columns:     ["PID", "Produit", "Stock", "Stock min", "Stock max", "Péremption", "Zone", "Catégorie", "PPV", "PPH", "TVA"],
  },
} satisfies Record<DocType, { title: string; description: string; icon: typeof Boxes; columns: string[] }>;


/** Which per-type feature gates each DocType. The upload endpoint requires
 *  BOTH `import` AND the doc-type feature, so the picker must hide types
 *  the caller can't actually submit. */
const TYPE_FEATURE: Record<DocType, Feature> = {
  achat: "achats",
  vente: "ventes",
  stock: "stock",
};


export default function UploadFilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFromUrl = parseTypeParam(searchParams.get("type"));

  const u = useUpload(typeFromUrl);
  const { pickType } = u;

  // Card-click handler: pick the type AND mirror it into ?type=... so the URL
  // stays a shareable deep-link to the active step. `replace: true` avoids
  // polluting the browser back-stack with every card toggle.
  const handlePickType = (t: DocType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", t);
      return next;
    }, { replace: true });
    pickType(t);
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
    return all.filter((t) => me?.permissions.includes(TYPE_FEATURE[t]));
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
            Importer un fichier
          </h1>
          <p className="text-sm text-muted-foreground">
            Importez vos exports Sobrus (Achats, Ventes ou Stock) au format CSV.
          </p>
        </div>
      </header>

      <Stepper current={u.step} />

      {/* ─── STEP 1 — Type ─── */}
      {u.step === 1 && (
        <section className="flex flex-col gap-4">
          {allowedTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucun type d'import disponible pour votre compte. Contactez votre administrateur.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {allowedTypes.map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                return (
                  <TypeCard
                    key={t}
                    type={t}
                    title={meta.title}
                    description={meta.description}
                    icon={<Icon className="size-5" />}
                    columns={meta.columns}
                    totalCols={meta.columns.length}
                    selected={u.docType === t}
                    onSelect={() => handlePickType(t)}
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
              Continuer
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
            Changer le type de document
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
           Renders when EITHER:
            • user has a locally-parsed file (preview + Importer button), OR
            • there's an existing job for this doc-type (queued / running /
              done — show its state card so the wizard rehydrates correctly
              on navigation even without local file state).
      */}
      {u.step === 3 && u.docType && (u.file || u.phase !== "idle") && (
        <section className="flex flex-col gap-4">
          <button
            type="button"
            onClick={u.file ? u.changeFile : u.reset}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {u.file ? "Choisir un autre fichier" : "Nouvel import"}
          </button>

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
                  Importer dans la base
                </button>
              </div>
            </>
          ) : (
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