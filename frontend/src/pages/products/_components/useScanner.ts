/** A USB barcode reader types like a keyboard, very fast, then (usually) Entrée. On a Produits page
 *  it works without clicking a field first: keys less than 50 ms apart, then Entrée (or 100 ms of
 *  silence after 8+ characters, for a reader set without Entrée) = a scan → that product's sheet,
 *  else « Aucun produit avec le code … ». Keys typed in a field (a price, an observation, the search
 *  bar with its own Entrée…) are left alone: a person types much slower anyway. */
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";

import { useT } from "@/i18n/I18nProvider";

import { useBarcodeLookup } from "./barcodeLookup";

const GAP_MS = 50;
const IDLE_MS = 100;
const MIN_WITH_ENTER = 4;
const MIN_WITHOUT_ENTER = 8;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function useScanner() {
  const t = useT();
  const { lookup } = useBarcodeLookup();
  const onScan = useEffectEvent(async (code: string) => {
    if ((await lookup(code)) === false) toast.error(t("products.scanNotFound", { code }));
  });

  useEffect(() => {
    let buffer = "";
    let last = 0;
    let timer: number | undefined;
    const scanned = (code: string) => {
      buffer = "";
      void onScan(code);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const quick = e.timeStamp - last < GAP_MS;
      window.clearTimeout(timer);
      if (e.key === "Enter") {
        if (quick && buffer.length >= MIN_WITH_ENTER) {
          e.preventDefault(); // not a click on the focused button
          scanned(buffer);
        }
        buffer = "";
        return;
      }
      if (e.key.length !== 1) return;
      if (!quick) buffer = ""; // a pause: a new code starts
      buffer += e.key;
      last = e.timeStamp;
      timer = window.setTimeout(() => {
        if (buffer.length >= MIN_WITHOUT_ENTER) scanned(buffer);
        else buffer = "";
      }, IDLE_MS);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, []);
}
