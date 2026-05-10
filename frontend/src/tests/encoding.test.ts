import { describe, expect, it } from "vitest";
import { cleanHeader, fixMojibake } from "@/utils/encoding";

describe("fixMojibake", () => {
  it("fixes é", () => {
    expect(fixMojibake("Cat√©gorie")).toBe("Catégorie");
  });

  it("fixes degree-sign mojibake", () => {
    expect(fixMojibake("HELIOCARE 360¬∞ MD A-R")).toBe("HELIOCARE 360° MD A-R");
  });

  it("fixes both è renderings", () => {
    expect(fixMojibake("R√©f√©rence")).toBe("Référence");
    expect(fixMojibake("Quantit√©")).toBe("Quantité");
    expect(fixMojibake("D√®s lors")).toBe("Dès lors");
    expect(fixMojibake("Probl√àme")).toBe("Problème");
  });

  it("fixes ï", () => {
    expect(fixMojibake("na√Øve")).toBe("naïve");
  });

  it("converts NBSP to regular space", () => {
    expect(fixMojibake("Foo¬†Bar")).toBe("Foo Bar");
  });

  it("is no-op for clean strings", () => {
    expect(fixMojibake("Catégorie")).toBe("Catégorie");
    expect(fixMojibake("plain ascii")).toBe("plain ascii");
  });

  it("handles empty/null/undefined", () => {
    expect(fixMojibake("")).toBe("");
    expect(fixMojibake(null)).toBe("");
    expect(fixMojibake(undefined)).toBe("");
  });

  it("is idempotent", () => {
    const once = fixMojibake("Cat√©gorie");
    expect(fixMojibake(once)).toBe(once);
  });
});

describe("cleanHeader", () => {
  it("fixes mojibake in headers", () => {
    expect(cleanHeader("Cat√©gorie")).toBe("Catégorie");
    expect(cleanHeader("Quantit√©")).toBe("Quantité");
  });

  it("aliases the 'Caégorie' typo to 'Catégorie'", () => {
    expect(cleanHeader("Caégorie")).toBe("Catégorie");
  });

  it("strips quotes and whitespace", () => {
    expect(cleanHeader('  "Produit"  ')).toBe("Produit");
  });
});
