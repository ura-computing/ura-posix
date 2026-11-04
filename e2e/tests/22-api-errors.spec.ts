/** Every error the API can answer, with its exact status and `code` (backend/app/core/errors.py; the gate
 *  « every error code triggered » in 99-gates), and the API fields no page sends (gate « every param / field »).
 *  The ones the pages show are tested there, through the UI; here the refusals a user can't reach by clicking
 *  (a wrong id, a role, an empty body) and the API-only fields, one request each, with setup / cleanup by API.
 *  Never changes the oracle's data (refused requests, or rows created then removed). */
import type { Browser, Page } from "@playwright/test";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../lib/api";
import { LOGGED_OUT, loadState, sessionFile } from "../lib/auth";
import type { Row } from "../lib/checks";
import { expect, recordCall, test } from "../lib/fixtures";
import { API } from "../lib/paths";

test.use({ storageState: sessionFile("owner") }); // each test stands alone: one refusal never hides the others

const NONE = 999_999; // an id nothing has

async function pageAs(browser: Browser, role: "admin" | null): Promise<Page> {
  const ctx = await browser.newContext({ storageState: role ? sessionFile(role) : LOGGED_OUT });
  return ctx.newPage();
}

/** The answer's `code` (the helpers already check the status). */
const codeOf = (answer: unknown) => (answer as { code?: string } | null)?.code;

/** POST a file (multipart `file`), recorded like the other calls. */
async function upload(page: Page, path: string, filename: string, content: string, status: number): Promise<Row> {
  const t0 = performance.now();
  const res = await page.request.post(`${API}/v1${path}`, {
    multipart: { file: { name: filename, mimeType: "text/csv", buffer: Buffer.from(content, "utf-8") } },
  });
  const body = await res.json().catch(() => null);
  recordCall({
    method: "POST",
    path: `/v1${path}`,
    status: res.status(),
    ms: Math.round(performance.now() - t0),
    source: "api",
    test: path,
    query: [],
    body: ["file"],
    code: res.status() >= 400 ? body?.code : undefined,
    codes: res.status() < 300 ? (body?.errors ?? []).map((e: Row) => e.code).filter(Boolean) : undefined,
  });
  expect(res.status(), `POST ${path} → ${JSON.stringify(body)}`).toBe(status);
  return body;
}

test("admin : on ne touche pas à un administrateur ; ids inconnus ; mauvaise pharmacie", async ({ browser }) => {
  const admin = await pageAs(browser, "admin");
  try {
    const users: Row[] = await apiGet(admin, "/admin/users");
    const adminId = users.find((u) => u.role === "admin")?.id;
    expect(adminId, "un administrateur").toBeTruthy();
    const pharmacyId = loadState().pharmacyId;
    expect(codeOf(await apiPut(admin, `/admin/users/${adminId}/permissions`, { permissions: {} }, 400))).toBe(
      "adminNoPermissions",
    );
    expect(codeOf(await apiDelete(admin, `/admin/users/${adminId}`, 400))).toBe("adminNotDeletable");
    expect(codeOf(await apiPatch(admin, `/admin/users/${adminId}/status`, { status: "inactive" }, 400))).toBe(
      "adminStatusLocked",
    );
    expect(codeOf(await apiPatch(admin, `/admin/users/${adminId}/pharmacy`, { pharmacy_id: pharmacyId }, 400))).toBe(
      "onlyMembersHavePharmacy",
    );
    expect(codeOf(await apiDelete(admin, `/admin/users/${NONE}`, 404))).toBe("userNotFound");
    expect(codeOf(await apiGet(admin, `/admin/pharmacies/${NONE}`, {}, 404))).toBe("pharmacyNotFound");
    const member = {
      full_name: "E2E Erreur",
      email: "e2e.erreur@pharmagest.ma",
      password: "Erreur#2026",
      role: "employee",
    };
    expect(
      codeOf(
        await apiPost(
          admin,
          `/admin/pharmacies/${pharmacyId}/users`,
          { ...member, pharmacy_id: pharmacyId + 1 },
          {},
          400,
        ),
      ),
    ).toBe("pharmacyIdMismatch");
    expect(codeOf(await apiPost(admin, `/admin/signup-requests/${NONE}/accept`, {}, {}, 404))).toBe("signupNotFound");
    expect(codeOf(await apiGet(admin, "/stats", {}, 403)), "les admins ont leurs routes").toBe("adminUseAdminRoutes");
    expect(
      codeOf(await apiGet(admin, `/admin/pharmacy/${pharmacyId}/stats/analyse-marge`, { mode: "liste" }, 400)),
    ).toBe("listeModeAdmin");
  } finally {
    await admin.context().close();
  }
});

test("admin : compte désactivé → connexion refusée ; pharmacie archivée → pas d'affectation", async ({ browser }) => {
  const admin = await pageAs(browser, "admin");
  const visitor = await pageAs(browser, null);
  const pharmacyId = loadState().pharmacyId;
  const account = { full_name: "E2E Désactivé", email: "e2e.desactive@pharmagest.ma", password: "Desactive#2026" };
  let userId: number | null = null;
  try {
    const created = await apiPost(
      admin,
      `/admin/pharmacies/${pharmacyId}/users`,
      { ...account, role: "employee", pharmacy_id: pharmacyId },
      {},
      200,
    );
    userId = created.id ?? created.user?.id ?? created.member?.id;
    await apiPatch(admin, `/admin/users/${userId}/status`, { status: "inactive" });
    expect(
      codeOf(await apiPost(visitor, "/auth/login", { email: account.email, password: account.password }, {}, 401)),
    ).toBe("accountDisabled");

    // A pharmacy archived (« Supprimer ») can't receive a member.
    const archived = await apiPost(admin, "/admin/pharmacies", { name: "E2E Archivée", city: "Rabat" });
    await apiDelete(admin, `/admin/pharmacies/${archived.id}`, 204);
    // API-only `include_archived`: the list hides it, unless asked.
    const listed = async (include: boolean) =>
      ((await apiGet(admin, "/admin/pharmacies", include ? { include_archived: true } : {})) as Row[]).some(
        (p) => p.id === archived.id,
      );
    expect(await listed(false), "liste : archivée cachée").toBe(false);
    expect(await listed(true), "include_archived : archivée montrée").toBe(true);
    expect(codeOf(await apiPatch(admin, `/admin/users/${userId}/pharmacy`, { pharmacy_id: archived.id }, 400))).toBe(
      "pharmacyArchived",
    );
  } finally {
    if (userId) await apiDelete(admin, `/admin/users/${userId}`, 204);
    await admin.context().close();
    await visitor.context().close();
  }
});

test("inscription : compte en attente sans pharmacie ; code de pharmacie inconnu ; demande déjà traitée", async ({
  browser,
}) => {
  const admin = await pageAs(browser, "admin");
  const visitor = await pageAs(browser, null);
  const who = { full_name: "E2E Code Inconnu", email: "e2e.codeinconnu@pharmagest.ma", phone: "+212600000099" };
  const password = "CodeInconnu#2026";
  try {
    await apiPost(visitor, "/auth/signup", { ...who, password, role: "employee", pharmacy_code: "ZZZ9999" });
    // Its pending account logs in, but no data route answers: it has no pharmacy yet.
    await apiPost(visitor, "/auth/login", { email: who.email, password });
    expect(codeOf(await apiGet(visitor, "/stats", {}, 400))).toBe("noPharmacy");

    const requests: Row[] = await apiGet(admin, "/admin/signup-requests");
    const req = requests.find((r) => r.email === who.email);
    expect(req, "la demande").toBeTruthy();
    expect(codeOf(await apiPost(admin, `/admin/signup-requests/${req!.id}/accept`, {}, {}, 409))).toBe(
      "pharmacyCodeUnknown",
    );
    await apiPost(admin, `/admin/signup-requests/${req!.id}/refuse`, {}, {}, 204);
    expect(codeOf(await apiPost(admin, `/admin/signup-requests/${req!.id}/accept`, {}, {}, 409))).toBe(
      "signupAlreadyDecided",
    );

    // API-only `pharmacy_address` (the form has no field for it): kept on the request the admin reads.
    const owner = { full_name: "E2E Adresse", email: "e2e.adresse@pharmagest.ma", phone: "+212600000098" };
    await apiPost(visitor, "/auth/signup", {
      ...owner,
      password,
      role: "owner",
      pharmacy_name: "E2E Pharmacie Adresse",
      pharmacy_city: "Rabat",
      pharmacy_address: "12 rue E2E",
    });
    const withAddress = ((await apiGet(admin, "/admin/signup-requests")) as Row[]).find((r) => r.email === owner.email);
    expect(withAddress?.new_pharmacy_address, "adresse gardée").toBe("12 rue E2E");
    await apiPost(admin, `/admin/signup-requests/${withAddress!.id}/refuse`, {}, {}, 204);
  } finally {
    await admin.context().close();
    await visitor.context().close();
  }
});

test("catalogue (admin) : doublon, nom vide, produit inconnu, suffixes, fichiers refusés", async ({ browser }) => {
  const admin = await pageAs(browser, "admin");
  try {
    const first: Row = (await apiGet(admin, "/admin/catalog", { limit: 1 })).data[0];
    expect(
      codeOf(await apiPost(admin, "/admin/catalog", { product: "E2E DOUBLON", barcode1: first.pid }, {}, 409)),
      "même PID",
    ).toBe("medicamentExists");
    expect(codeOf(await apiPost(admin, "/admin/catalog", { product: "   " }, {}, 400))).toBe("productNameRequired");
    expect(codeOf(await apiPut(admin, `/admin/catalog/${NONE}`, { product: "x" }, 404))).toBe("medicamentNotFound");

    expect(codeOf(await apiPut(admin, `/category-suffixes/${NONE}`, { category: "x", suffix: "y" }, 404))).toBe(
      "suffixNotFound",
    );
    const suffix = await apiPost(
      admin,
      "/category-suffixes",
      { category: "E2E Catégorie Erreur", suffix: "ER" },
      {},
      201,
    );
    try {
      expect(
        codeOf(await apiPost(admin, "/category-suffixes", { category: "E2E Catégorie Erreur", suffix: "E2" }, {}, 409)),
      ).toBe("suffixExists");
    } finally {
      await apiDelete(admin, `/category-suffixes/${suffix.id}`, 204);
    }

    // Catalogue file: not a .csv, empty, a row without its name (refused row, the file answers 200).
    expect(codeOf(await upload(admin, "/uploads/catalog", "catalogue.txt", "Nom\nX\n", 400))).toBe("csvOnly");
    expect(codeOf(await upload(admin, "/uploads/catalog", "vide.csv", "Nom,Categorie,TVA,PPV,PPH\n", 400))).toBe(
      "emptyFile",
    );
    const partial = await upload(admin, "/uploads/catalog", "sans-nom.csv", "Nom,Categorie\n,Médicament\n", 200);
    expect((partial.errors as Row[]).map((e) => e.code)).toContain("rowMissingName");
  } finally {
    await admin.context().close();
  }
});

test("imports : lot inconnu, statut inconnu, lot d'une autre pharmacie, lot déjà supprimé, envoi vide", async ({
  page,
  browser,
}) => {
  const admin = await pageAs(browser, "admin");
  const stranger = await pageAs(browser, null);
  // The owner of another pharmacy (made here): an E2E pharmacy batch is not his.
  const account = {
    full_name: "E2E Autre Pharmacie",
    email: "e2e.autre@pharmagest.ma",
    password: "AutrePharmacie#2026",
  };
  const pharmacy = await apiPost(admin, "/admin/pharmacies", { name: "E2E Autre Pharmacie", city: "Rabat" });
  const { member } = await apiPost(admin, `/admin/pharmacies/${pharmacy.id}/users`, {
    ...account,
    role: "owner",
    pharmacy_id: pharmacy.id,
  });
  try {
    expect(codeOf(await apiPatch(page, `/uploads/batches/${NONE}`, { status: "nimporte" }, 400))).toBe(
      "invalidBatchStatus",
    );
    expect(codeOf(await apiPatch(page, `/uploads/batches/${NONE}`, { status: "error" }, 404))).toBe("batchNotFound");
    expect(codeOf(await apiDelete(page, `/data/imports/${NONE}`, 404))).toBe("batchNotFound");
    expect(codeOf(await apiPost(page, "/uploads/achat-json", { rows: [] }, {}, 400))).toBe("emptyBody");
    // `batch_id` (a 2nd chunk of the same file; the E2E stock file fits in one) is read with the rows.
    expect(codeOf(await apiPost(page, "/uploads/stock-json", { rows: [], batch_id: NONE }, {}, 400))).toBe("emptyBody");

    const mine: Row[] = (await apiGet(page, "/data/imports", { limit: 200 })).data;
    await apiPost(stranger, "/auth/login", { email: account.email, password: account.password });
    expect(codeOf(await apiPatch(stranger, `/uploads/batches/${mine[0].id}`, { status: "error" }, 403))).toBe(
      "batchForbidden",
    );
    // His own import (one line without PID: an empty import, nothing written), deleted twice.
    const { batch_id } = await apiPost(stranger, "/uploads/stock-json", { rows: [{ PID: "" }], filename: "vide.csv" });
    await apiDelete(stranger, `/data/imports/${batch_id}`);
    expect(codeOf(await apiDelete(stranger, `/data/imports/${batch_id}`, 409))).toBe("batchAlreadyDeleted");
  } finally {
    await apiDelete(admin, `/admin/users/${member.id}`, 204);
    await apiDelete(admin, `/admin/pharmacies/${pharmacy.id}`, 204);
    await stranger.context().close();
    await admin.context().close();
  }
});

test("propriétaire : routes admin, mode liste, export trop gros, ids inconnus", async ({ page }) => {
  expect(codeOf(await apiGet(page, "/admin/users", {}, 403))).toBe("adminOnly");
  expect(codeOf(await apiGet(page, "/stats/analyse-marge", { mode: "liste" }, 400))).toBe("listeModeUsePost");
  const rows = Number(process.env.E2E_ROWS ?? 100_000);
  if (rows > 50_000) {
    expect(
      codeOf(await apiGet(page, "/ventes", { export: true, date_from: "2000-01-01", date_to: "2100-12-31" }, 413)),
      "plus de 50 000 lignes",
    ).toBe("exportTooLarge");
  }
  expect(codeOf(await apiDelete(page, `/accounting/payments/${NONE}`, 404))).toBe("paymentNotFound");
  expect(codeOf(await apiDelete(page, `/owner/employees/${NONE}`, 404))).toBe("employeeNotFound");
  expect(codeOf(await apiDelete(page, `/sessions/${NONE}`, 404))).toBe("sessionNotFound");
  const med: Row = (await apiGet(page, "/products", { limit: 1 })).data[0];
  expect(codeOf(await apiDelete(page, `/products/${med.id}/notes/${NONE}`, 404))).toBe("noteNotFound");
});

test("produits spéciaux, BL, fournisseurs : vide ou introuvable", async ({ page }) => {
  expect(codeOf(await apiPost(page, "/bl-exclusions/", { delivery_ref: "   " }, {}, 422))).toBe("blRefEmpty");
  expect(codeOf(await apiPost(page, "/bl-exclusions/", { delivery_ref: "E2E-BL-INCONNU" }, {}, 404))).toBe(
    "blNotFound",
  );
  expect(codeOf(await apiGet(page, "/bl-exclusions/detail", { delivery_ref: "E2E-BL-INCONNU" }, 404))).toBe(
    "blNotFound",
  );
  expect(codeOf(await apiPost(page, "/supplier-exclusions/", { supplier: "   " }, {}, 422))).toBe("supplierEmpty");
  expect(codeOf(await apiPost(page, "/supplier-exclusions/", { supplier: "E2E FOURNISSEUR INCONNU" }, {}, 404))).toBe(
    "supplierNotFound",
  );
  expect(codeOf(await apiPost(page, "/special-products/", { medicament_ids: [NONE] }, {}, 404))).toBe(
    "medicamentsNotFound",
  );
  expect(codeOf(await apiGet(page, "/bl-line-exclusions/lines", { medicament_id: NONE }, 404))).toBe(
    "medicamentNotFound",
  );
});

test("connexion Sobrus : pas connecté, import inconnu, accord manquant", async ({ page }) => {
  // The E2E pharmacy never connected Sobrus (20-sobrus uses its own pharmacy).
  expect(codeOf(await apiDelete(page, "/sobrus/connection", 404))).toBe("sobrusNotConnected");
  expect(codeOf(await apiPost(page, "/sobrus/runs", { mode: "check" }, {}, 409))).toBe("sobrusNotConnected");
  expect(codeOf(await apiPost(page, `/sobrus/runs/${NONE}/cancel`, {}, {}, 404))).toBe("sobrusRunNotFound");
  expect(
    codeOf(await apiPut(page, "/sobrus/connection", { email: "x@sobrus.e2e", password: "x", consent: false }, 422)),
  ).toBe("consentRequired");
});

test("champs que seule l'API envoie : notes à l'exclusion, achats sans le non déclaré, PPH + description", async ({
  page,
}) => {
  // The pages create an exclusion, then save its note (PUT …/note); the API also takes `notes` at once.
  const row: Row = (await apiGet(page, "/achats", { limit: 1 })).data[0];
  const med: Row = (await apiGet(page, "/products", { search: row.pid })).data.find((p: Row) => p.pid === row.pid);
  const totals = async (include: boolean) => ({
    lines: (await apiGet(page, "/achats", { limit: 1, include_non_declared: include })).pagination.total,
    summary: await apiGet(page, "/achats/supplier-summary", { include_non_declared: include }),
  });
  await apiPost(page, "/supplier-exclusions/", { supplier: row.supplier, notes: "E2E note fournisseur" }, {}, 201);
  try {
    const suppliers: Row[] = await apiGet(page, "/supplier-exclusions/");
    expect(suppliers.find((x) => x.supplier === row.supplier)?.notes).toBe("E2E note fournisseur");
    // Achats without the non-declared (Comptabilité): fewer lines, another summary.
    const all = await totals(true);
    const declared = await totals(false);
    expect(declared.lines, "sans le fournisseur exclu").toBeLessThan(all.lines);
    expect(declared.summary, "résumé fournisseurs").not.toEqual(all.summary);
  } finally {
    await apiPost(page, "/supplier-exclusions/reintegrate", { suppliers: [row.supplier] });
  }

  await apiPost(page, "/bl-exclusions/", { delivery_ref: row.delivery_ref, notes: "E2E note BL" }, {}, 201);
  try {
    const bls: Row[] = await apiGet(page, "/bl-exclusions/");
    expect(bls.find((x) => x.delivery_ref === row.delivery_ref)?.notes).toBe("E2E note BL");
  } finally {
    await apiPost(page, "/bl-exclusions/reintegrate", { delivery_refs: [row.delivery_ref] });
  }

  const line = await apiPost(
    page,
    "/bl-line-exclusions/",
    { medicament_id: med.id, delivery_refs: [row.delivery_ref], notes: "E2E note ligne" },
    {},
    201,
  );
  try {
    const lines: Row[] = await apiGet(page, "/bl-line-exclusions/");
    expect(lines.find((x) => line.ids.includes(x.id))?.notes).toBe("E2E note ligne");
  } finally {
    await apiPost(page, "/bl-line-exclusions/reintegrate", { ids: line.ids });
  }

  // PPH + description: no longer on the product page, still saved by the API (old clients).
  const last: Row = (await apiGet(page, "/products", { page: 2, limit: 25 })).data.at(-1);
  await apiPut(page, `/products/${last.id}`, { pph: 12.34, description: "E2E description" });
  const sheet = await apiGet(page, `/products/${last.id}`);
  expect(sheet.prices.pph, "PPH (prices.pph)").toBeCloseTo(12.34, 2);
  expect(sheet.info?.description, "description (info.description)").toBe("E2E description");
});
