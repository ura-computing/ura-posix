import { describe, expect, it } from "vitest";
import { tokenizeSearch, matchesAllTokens } from "@/utils/search";

describe("tokenizeSearch", () => {
  it("returns empty array for blank input", () => {
    expect(tokenizeSearch("")).toEqual([]);
    expect(tokenizeSearch("   ")).toEqual([]);
    expect(tokenizeSearch(null)).toEqual([]);
    expect(tokenizeSearch(undefined)).toEqual([]);
  });

  it("splits on whitespace", () => {
    expect(tokenizeSearch("la roche posay")).toEqual(["la", "roche", "posay"]);
  });

  it("splits on `*`", () => {
    expect(tokenizeSearch("*roche*posay")).toEqual(["roche", "posay"]);
    expect(tokenizeSearch("*anthe")).toEqual(["anthe"]);
  });

  it("treats `*` and whitespace as equivalent separators", () => {
    expect(tokenizeSearch("la *roche posay")).toEqual(["la", "roche", "posay"]);
  });

  it("lowercases tokens and de-duplicates", () => {
    expect(tokenizeSearch("Roche ROCHE rocheford")).toEqual(["roche", "rocheford"]);
  });
});

describe("matchesAllTokens", () => {
  it("matches when all tokens are substrings of the haystack", () => {
    expect(matchesAllTokens("Anthelios La Roche-Posay", ["roche", "anthe"])).toBe(true);
  });

  it("fails when any token is missing", () => {
    expect(matchesAllTokens("Anthelios SPF50", ["roche"])).toBe(false);
  });

  it("matches everything when token list is empty", () => {
    expect(matchesAllTokens("anything", [])).toBe(true);
  });
});
