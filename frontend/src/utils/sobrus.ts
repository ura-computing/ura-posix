/** « Connexion Sobrus » runs as sentences, for its page, the corner card on every page
 *  (`_components/SobrusRunCard.tsx`) and the admin Catalogue's « Importer les produits depuis Sobrus »: what the robot
 *  does now, each step done, how a run ended. */
import type { TFn } from "@/i18n/I18nProvider";
import type { SobrusEvent, SobrusRun } from "@/types";
import { formatDate, formatNumStr } from "@/utils/format";

export const kindName = (t: TFn, kind: string | null | undefined) =>
  kind === "achat" ? t("nav.achats") : kind === "vente" ? t("nav.ventes") : kind === "stock" ? t("nav.stock") : "";
/** « Ventes 2026 », « Stock ». */
export const fileName = (t: TFn, run: SobrusRun) => [kindName(t, run.kind), run.year].filter(Boolean).join(" ");
export const modeName = (t: TFn, run: SobrusRun) =>
  t(`sobrus.mode.${run.mode}`, { start: formatDate(run.date_from), end: formatDate(run.date_to) });
export const errorText = (t: TFn, code: string | null | undefined) => {
  const key = `errors.${code}`;
  const text = t(key);
  return text === key ? t("errors.serverError") : text;
};

/** One step done by the robot, as a sentence. */
export function eventText(t: TFn, e: SobrusEvent): string {
  const vars = {
    kind: kindName(t, e.kind),
    year: e.year ?? "",
    n: formatNumStr(e.n ?? 0),
    start: formatDate(e.start),
    end: formatDate(e.end),
    error: errorText(t, e.error),
    filled: formatNumStr(e.filled ?? 0),
  };
  const key = `sobrus.event.${e.code}`;
  const text = t(key, vars);
  return text === key ? e.code : text;
}

/** What the robot does right now. */
export function currentStep(t: TFn, run: SobrusRun): string {
  if (run.status === "queued") return t("sobrus.stepQueued");
  if (run.cancel_requested) return t("sobrus.stepStopping");
  if (run.phase === "login") return t("sobrus.stepLogin");
  if (run.phase === "download") {
    return t("sobrus.stepDownload", { what: fileName(t, run), size: formatNumStr(run.bytes_received / 1_048_576, 1) });
  }
  if (run.phase === "import") {
    return t("sobrus.stepImport", { what: fileName(t, run), current: run.chunk_current, total: run.chunk_total });
  }
  if (run.phase === "closing") return t("sobrus.stepClosing", { current: run.chunk_current, total: run.chunk_total });
  if (run.phase === "products") {
    return t("sobrus.stepProducts", { page: run.chunk_current, n: formatNumStr(run.lines_added) });
  }
  return t("sobrus.stepWorking");
}

/** How a run ended (« Terminé : 1 234 ligne(s) ajoutée(s) », the error, « Arrêté … »). */
export function runResult(t: TFn, run: SobrusRun): string {
  if (run.status === "success") {
    if (run.mode === "check") return t("sobrus.resultChecked");
    if (run.mode === "products") {
      const done = run.events.find((e) => e.code === "products_done");
      return t("sobrus.resultProducts", { n: formatNumStr(done?.n ?? 0), filled: formatNumStr(done?.filled ?? 0) });
    }
    return t("sobrus.resultDone", { n: formatNumStr(run.lines_added) });
  }
  if (run.status === "error") return errorText(t, run.error_code);
  if (run.status === "cancelled") return t("sobrus.resultCancelled", { n: formatNumStr(run.lines_added) });
  return t("sobrus.resultRunning");
}
