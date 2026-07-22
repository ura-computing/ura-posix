/** Guards the whole i18n effort: fr and es must have the EXACT same key set,
 *  and t() must resolve + interpolate. If a page adds a French key without its
 *  Spanish translation (or vice-versa), this test fails — nothing is "missed". */
import { describe, expect, it } from "vitest";

import { fr } from "../locales/fr";
import { es } from "../locales/es";


function flatKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}


describe("i18n fr/es parity", () => {
  const frKeys = flatKeys(fr).sort();
  const esKeys = flatKeys(es).sort();

  it("has the same key set in both languages", () => {
    const missingInEs = frKeys.filter((k) => !esKeys.includes(k));
    const missingInFr = esKeys.filter((k) => !frKeys.includes(k));
    expect({ missingInEs, missingInFr }).toEqual({ missingInEs: [], missingInFr: [] });
  });

  it("has no empty values", () => {
    const emptyFr = flatKeys(fr).filter((k) =>
      k.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], fr) === "");
    const emptyEs = flatKeys(es).filter((k) =>
      k.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], es) === "");
    expect({ emptyFr, emptyEs }).toEqual({ emptyFr: [], emptyEs: [] });
  });
});
