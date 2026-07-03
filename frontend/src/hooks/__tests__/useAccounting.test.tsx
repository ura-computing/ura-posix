/** Tests for /accounting/payments hooks (list / save / delete). */
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { useDeletePayment, usePayments, useSavePayment } from "@/hooks/useAccounting";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


const sample = {
  id: 1, month: "2026-06", method: "especes",
  pharmacie_amount: 100, parapharmacie_amount: 50, count: 5,
};


describe("usePayments", () => {
  test("happy returns list", async () => {
    server.use(http.get("*/v1/accounting/payments", () => HttpResponse.json([sample])));
    const { result } = renderHookWithProviders(() => usePayments());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
  });

  test("month query param forwarded", async () => {
    let seen = "";
    server.use(http.get("*/v1/accounting/payments", ({ request }) => {
      seen = new URL(request.url).searchParams.get("month") ?? "";
      return HttpResponse.json([]);
    }));
    const { result } = renderHookWithProviders(() => usePayments("2026-06"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seen).toBe("2026-06");
  });

  test("error state", async () => {
    server.use(http.get("*/v1/accounting/payments", () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHookWithProviders(() => usePayments());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useSavePayment", () => {
  test("happy invalidates payments prefix", async () => {
    server.use(http.post("*/v1/accounting/payments", () => HttpResponse.json(sample)));
    const { result, qc } = renderHookWithProviders(() => useSavePayment());
    qc.setQueryData(["payments", "2026-06"], [sample]);
    await result.current.mutateAsync({
      month: "2026-06", method: "especes",
      pharmacie_amount: 100, parapharmacie_amount: 50, count: 5,
    });
    expect(qc.getQueryState(["payments", "2026-06"])?.isInvalidated).toBe(true);
  });
});


describe("useDeletePayment", () => {
  test("happy invalidates payments prefix", async () => {
    server.use(http.delete("*/v1/accounting/payments/1", () =>
      HttpResponse.json({ deleted: true })));
    const { result, qc } = renderHookWithProviders(() => useDeletePayment());
    qc.setQueryData(["payments", "2026-06"], [sample]);
    await result.current.mutateAsync(1);
    expect(qc.getQueryState(["payments", "2026-06"])?.isInvalidated).toBe(true);
  });
});
