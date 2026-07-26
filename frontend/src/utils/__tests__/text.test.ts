import { describe, expect, it } from "vitest";

import { matchesFields, matchesText, normalizeText } from "../text";

describe("normalizeText", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeText("MÉDICAMENT")).toBe("medicament");
    expect(normalizeText("Diététique")).toBe("dietetique");
    expect(normalizeText(null)).toBe("");
  });
});

describe("matchesText — * wildcard semantics", () => {
  it("no wildcard = substring (contains)", () => {
    expect(matchesText("Rinomicine", "ino")).toBe(true);
    expect(matchesText("Rinomicine", "xyz")).toBe(false);
  });

  it("trailing * = prefix (Rino*)", () => {
    expect(matchesText("Rinomicine", "rino*")).toBe(true);
    expect(matchesText("Doliprane", "rino*")).toBe(false);
  });

  it("leading * = suffix (*enil)", () => {
    expect(matchesText("Amoxicilline", "*ine")).toBe(true);
    expect(matchesText("Doliprane", "*enil")).toBe(false);
  });

  it("infix * (ra*ol)", () => {
    expect(matchesText("Rabeprazol", "ra*ol")).toBe(true);
    expect(matchesText("Rinomicine", "ra*ol")).toBe(false);
  });

  it("anchors PER WORD of a multi-word product name, not the whole field", () => {
    const product = "RINOMICINE ST B10 SACHETS";
    // the WORD "rinomicine" starts with "rinom" and ends with "ne"
    expect(matchesText(product, "rinom*ne")).toBe(true);
    // prefix still works
    expect(matchesText(product, "rinom*")).toBe(true);
    // suffix matches a word, even though the field ends in "sachets"
    expect(matchesText(product, "*cine")).toBe(true);
    // a wildcard must NOT span across words (no false positive)
    expect(matchesText(product, "rinom*sachets")).toBe(false);
  });

  it("accent- and case-insensitive", () => {
    expect(matchesText("PARACÉTAMOL", "paracetamol")).toBe(true);
    expect(matchesText("Diététique", "dietetique*")).toBe(true);
  });

  it("whitespace ANDs tokens", () => {
    expect(matchesText("Doliprane 1000mg", "doli 1000")).toBe(true);
    expect(matchesText("Doliprane 1000mg", "doli 500")).toBe(false);
  });

  it("empty query matches everything", () => {
    expect(matchesText("anything", "")).toBe(true);
    expect(matchesText("anything", "   ")).toBe(true);
  });

  it("regex metacharacters in the query are treated literally", () => {
    expect(matchesText("prix (2.50)", "(2.50)")).toBe(true);
    expect(matchesText("prix 250", "(2.50)")).toBe(false);
  });
});

describe("matchesFields — each token may match any field", () => {
  it("tokens can match across different fields", () => {
    expect(matchesFields(["Doliprane", "MED001", "Casablanca"], "doli casa")).toBe(true);
    expect(matchesFields(["Doliprane", "MED001"], "doli xxx")).toBe(false);
  });

  it("wildcard anchors per word (matches a word amid other words)", () => {
    // "*prane" matches the WORD "doliprane" — even with other words present
    expect(matchesFields(["Doliprane", "MED001"], "*prane")).toBe(true);
    expect(matchesFields(["Doliprane extra", "MED001"], "*prane")).toBe(true);
    // a wildcard must NOT span across a space
    expect(matchesFields(["Doli prane", "MED001"], "doli*prane")).toBe(false);
  });
});
