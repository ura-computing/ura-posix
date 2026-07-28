/** OLD-APP PARITY GUARD — the /analyses Excel export must produce the exact
 *  same headers (labels + order) as the old apcm-pharma app, per client
 *  request. If a header here changes, the client's archived exports stop
 *  lining up — update ONLY with explicit approval. */
import { describe, expect, it } from "vitest";

import { EXPORT_COLS } from "../_constants";
import type { AnalyseMargeRow } from "@/types";


const OLD_APP_HEADERS: Record<string, string[]> = {
  produit: [
    "Produit", "Stock dispo", "Vente total unit", "Vente total DH",
    "Prix unit +", "Prix unit -", "Prix unit X", "PPV",
    "Marge% X", "Marge DH X", "Catégorie", "TVA",
  ],
  categorie: [
    "Catégorie", "Prix max", "Prix min", "Prix moy.",
    "Marge % moy.", "Marge DH moy.", "Qté", "CA (MAD)",
  ],
  grossiste: [
    "Grossiste", "Prix max", "Prix min", "Prix moy.",
    "Marge % moy.", "Marge DH moy.", "Qté", "CA (MAD)",
  ],
  laboratoire: [
    "Laboratoire", "Prix max", "Prix min", "Prix moy.",
    "Marge % moy.", "Marge DH moy.", "Qté", "CA (MAD)",
  ],
  operateur: ["Opérateur / Client", "Transactions", "Qté", "CA (MAD)"],
  mois:      ["Mois", "Transactions", "Qté", "CA (MAD)"],
  annee: [
    "Année",
    "Jan (Qty)", "Jan (CA)", "Fév (Qty)", "Fév (CA)", "Mar (Qty)", "Mar (CA)",
    "Avr (Qty)", "Avr (CA)", "Mai (Qty)", "Mai (CA)", "Juin (Qty)", "Juin (CA)",
    "Juil (Qty)", "Juil (CA)", "Août (Qty)", "Août (CA)", "Sep (Qty)", "Sep (CA)",
    "Oct (Qty)", "Oct (CA)", "Nov (Qty)", "Nov (CA)", "Déc (Qty)", "Déc (CA)",
    "Total Qté", "Total CA",
  ],
  // Old app never exported the liste comparison (its "Liste" tab exported BL
  // aggregates that no longer exist) — we export the comparison table with the
  // old TABLE's headers and a French Statut.
  liste: [
    "Statut", "Produit", "Stock dispo", "Ventes", "PPV", "PU moy.",
    "Marge %", "Marge DH", "Catégorie",
  ],
};


describe("EXPORT_COLS — old-app export parity", () => {
  for (const [mode, headers] of Object.entries(OLD_APP_HEADERS)) {
    it(`${mode}: headers match the old app exactly`, () => {
      expect(EXPORT_COLS[mode as keyof typeof EXPORT_COLS].map((c) => c.label)).toEqual(headers);
    });
  }

  it("liste: Statut exports French labels, not raw enum values", () => {
    const statut = EXPORT_COLS.liste[0];
    expect(statut.raw({ match_status: "found" } as AnalyseMargeRow)).toBe("Trouvé");
    expect(statut.raw({ match_status: "not_found" } as AnalyseMargeRow)).toBe("Introuvable");
  });

  it("produit: raw accessors return unformatted backend values", () => {
    const row = {
      product: "DOLIPRANE", stock_dispo: 12, qty: 124, ca: 3437.28,
      prix_max: 19.23, prix_min: 15.32, prix_avg: 17.14, ppv: 27.2,
      marge_pct: 36.987, marge_dh: 10.06, category: "Médicament", tva: "Exonéré (0.00%)",
    } as AnalyseMargeRow;
    const values = EXPORT_COLS.produit.map((c) => c.raw(row));
    expect(values).toEqual([
      "DOLIPRANE", 12, 124, 3437.28, 19.23, 15.32, 17.14, 27.2,
      36.987, 10.06, "Médicament", "Exonéré (0.00%)",
    ]);
  });
});
