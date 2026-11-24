/** Admin pages. Rapport admin (Vue système + drill-down on the E2E pharmacy,
 *  every field vs the oracle), pharmacies (a throwaway pharmacy: create, edit,
 *  features, member permissions / status / password / delete, archive),
 *  catégories (suffix lifecycle + its effect on the owner's ventes) and
 *  catalogue (list, search, filters, add, edit with the TVA alert, delete, CSV
 *  import). The E2E pharmacy is only READ, so later specs keep the oracle. */
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost } from "../lib/api";
import { ALL_FEATURES, PHARMACY_FEATURES, loadState, saveState, sessionFile } from "../lib/auth";
import {
  CATEGORY_TYPES,
  checkAnalyse,
  checkMarginAlerts,
  checkStats,
  checkStockSummary,
  type Row,
} from "../lib/checks";
import { expectSame, expectSameSet } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";
import { columnTexts, frNumber, kpiValue, pageCall, pageSend, period, pickCategoryType, setPeriod } from "../lib/ui";

test.use({ storageState: sessionFile("admin") });

const pharmacyId = (): number => loadState().pharmacyId;
const sorted = (xs: string[]) => [...xs].sort();

/** /rapport as admin, drill-down on the E2E pharmacy (picker = first « Pharmacie » button;
 *  the Mixte / Pharmacie / Parapharmacie segment comes after it). */
async function openAdminRapport(page: Page): Promise<void> {
  await page.goto("/rapport");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tableau de bord",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pharmacie", exact: true }).first().click();
  await page.getByRole("button", { name: /· Pharmacie E2E$/ }).click();
}

/** Drill-down « Alertes marges » + « Stock » tiles show the API answers. */
async function checkAlertStockTiles(page: Page, alerts: Row, stock: Row): Promise<void> {
  const tiles: [string, number][] = [
    ["Marge négative", Math.abs(alerts.negative.total_margin_dh)],
    ["Marge 0 % à 10 %", alerts.low.total_ca],
    ["Marge 60 % à 89,9 %", alerts.high.total_ca],
    ["Marge supérieure à 90 %", alerts.very_high.total_ca],
    ["Total références", stock.total_references],
    ["PPV potentiel", stock.ppv_potentiel],
    ["Santé du stock", stock.health_pct],
  ];
  // poll: after a category switch the tiles redraw a moment after the API answer.
  for (const [label, want] of tiles) {
    await expect
      .poll(
        async () => Math.abs((frNumber(await kpiValue(page, label).innerText()) ?? NaN) - want),
        `tuile « ${label} » = ${want}`,
      )
      .toBeLessThanOrEqual(0.011);
  }
  await expect
    .poll(
      async () => (await kpiValue(page, "Sous-stock / Sur-stock").innerText()).replace(/[\s\u00a0\u202f]/g, ""),
      "tuile « Sous-stock / Sur-stock »",
    )
    .toBe(`${stock.sous_stock_count}/${stock.sur_stock_count}`);
}

/** Admin Rapport « Vue système »: the users + catalogue tiles show /admin/stats.
 *  Returns the active users count, then goes back to the page it came from. */
async function activeUsersTile(page: Page): Promise<number> {
  const back = page.url();
  const stats = pageCall(page, "/admin/stats");
  await page.goto("/rapport");
  const s = await stats;
  for (const [label, want] of [
    ["Utilisateurs actifs", s.total_active_users],
    ["Médicaments au catalogue", s.total_catalog_items],
  ]) {
    await expect.poll(async () => frNumber(await kpiValue(page, label).innerText()), `tuile « ${label} »`).toBe(want);
  }
  await page.goto(back);
  return s.total_active_users;
}

/** Row kebab → one menu entry. */
async function rowAction(page: Page, email: string, action: string): Promise<void> {
  await page
    .getByRole("row", { name: new RegExp(email) })
    .getByRole("button", { name: "Plus d'actions" })
    .click();
  await page.getByRole("menu").getByRole("menuitem", { name: action, exact: true }).click();
}

test("rapport admin : vue système + Pharmacie E2E × Mixte / Pharmacie / Parapharmacie", async ({ page }) => {
  const w = testWindow();
  const id = pharmacyId();
  const system = pageCall(page, "/admin/stats");
  const pharmacies = pageCall<Row[]>(page, "/admin/pharmacies");
  const stock = pageCall(page, `/admin/pharmacy/${id}/stats/stock-summary`); // loaded once the pharmacy is picked
  await openAdminRapport(page);
  const s = await system;
  expectSame(
    s,
    {
      total_pharmacies: (await pharmacies).length,
      total_catalog_items: expected().catalog.total,
      pending_catalog_requests: 0,
    },
    "/admin/stats",
  );
  saveState({ activeUsers: s.total_active_users });

  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const q = { ...period(w), category_type: ct };
      const stats = pageCall(page, `/admin/pharmacy/${id}/stats`, {
        ...q,
        include_non_declared: "true",
      });
      const analyse = pageCall(page, `/admin/pharmacy/${id}/stats/analyse-marge`, { ...q, mode: "produit" });
      const alerts = pageCall(page, `/admin/pharmacy/${id}/stats/margin-alerts`, q);
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkStats(await stats, ct);
      checkAnalyse(await analyse, ct, "produit");
      const a = await alerts;
      checkMarginAlerts(a, ct);
      const st = await stock;
      if (i === 0) checkStockSummary(st);
      await checkAlertStockTiles(page, a, st); // the 2 drill-down sections (G8) on screen
    });
  }
  for (const [mode, tab] of [
    ["categorie", "Par catégorie"],
    ["grossiste", "Par grossiste"],
  ] as const) {
    await test.step(tab, async () => {
      const analyse = pageCall(page, `/admin/pharmacy/${id}/stats/analyse-marge`, {
        ...period(w),
        category_type: "parapharmacie",
        mode,
      });
      await page.getByRole("tab", { name: tab, exact: true }).click();
      checkAnalyse(await analyse, "parapharmacie", mode);
    });
  }
});

/** Admin « Analyse de marge » table, per tab: [mode, tab (null = default), name column, row key, value columns]. */
const MARGE_TABS = [
  [
    "produit",
    null,
    "Produit",
    "product",
    [
      ["Qté", "qty"],
      ["Ventes (MAD)", "ca"],
      ["PPV", "ppv"],
      ["Marge %", "marge_pct"],
      ["Marge DH", "marge_dh"],
    ],
  ],
  [
    "categorie",
    "Par catégorie",
    "Catégorie",
    "category",
    [
      ["Qté", "qty"],
      ["CA (MAD)", "ca"],
      ["Marge % moy.", "marge_pct_avg"],
      ["Marge DH moy.", "marge_dh_avg"],
    ],
  ],
  [
    "grossiste",
    "Par grossiste",
    "Grossiste",
    "grossiste",
    [
      ["Qté", "qty"],
      ["CA (MAD)", "ca"],
      ["Marge % moy.", "marge_pct_avg"],
      ["Marge DH moy.", "marge_dh_avg"],
    ],
  ],
] as const;

test("rapport admin : le tableau « Analyse de marge » affiche les valeurs de l'API (3 onglets)", async ({ page }) => {
  const w = testWindow();
  const answer = (mode: string) =>
    pageCall(page, `/admin/pharmacy/${pharmacyId()}/stats/analyse-marge`, {
      ...period(w),
      category_type: "all",
      mode,
    });
  let next = answer("produit");
  await openAdminRapport(page);
  await setPeriod(page, w.date_from, w.date_to);
  for (const [mode, tab, nameCol, nameKey, cols] of MARGE_TABS) {
    await test.step(mode, async () => {
      if (tab) {
        next = answer(mode);
        await page.getByRole("tab", { name: tab, exact: true }).click();
      }
      const rows = (await next).rows as Row[];
      // The drill-down has other tables (categories donut): take the one under « Analyse de marge ».
      const table = page
        .locator("div")
        .filter({
          has: page.getByRole("heading", {
            name: "Analyse de marge",
            exact: true,
          }),
        })
        .last()
        .locator("table");
      // columnTexts reads at once: wait until this tab's rows are drawn (not the previous tab's).
      await expect(table.getByRole("columnheader", { name: nameCol, exact: true })).toBeVisible();
      await expect(table.locator("tbody tr").first()).toContainText(String(rows[0]?.[nameKey] ?? "—"));
      const names = await columnTexts(page, nameCol, table);
      expect(names.length, `${mode}: lignes affichées`).toBeGreaterThan(0);
      const shown = rows.slice(0, names.length);
      expect(names, `${mode}: ${nameCol}`).toEqual(shown.map((r) => String(r[nameKey] ?? "—")));
      for (const [header, key] of cols) {
        const got = (await columnTexts(page, header, table)).map(frNumber);
        const bad = shown.flatMap((r, i) => {
          const want = r[key] == null ? null : Math.round(Number(r[key]) * 100) / 100;
          return got[i] === want || (got[i] != null && want != null && Math.abs(got[i]! - want) <= 0.011)
            ? []
            : [`${names[i]}: ${got[i]} ≠ ${want}`];
        });
        expect(bad.slice(0, 10), `${mode}: « ${header} »`).toEqual([]);
      }
      if (mode === "produit") {
        // 25 products per page; « Suivant » shows the next 25, in the API's order.
        expect(names.length, "produit: 25 lignes par page").toBe(Math.min(25, rows.length));
        await page
          .locator("div")
          .filter({ has: page.getByRole("heading", { name: "Analyse de marge", exact: true }) })
          .last()
          .locator("button", { hasText: "Suivant" })
          .click();
        await expect(table.locator("tbody tr").first()).toContainText(String(rows[25]?.[nameKey] ?? "—"));
        expect(await columnTexts(page, nameCol, table), "produit: page 2").toEqual(
          rows.slice(25, 50).map((r) => String(r[nameKey] ?? "—")),
        );
      }
    });
  }
});

test("pharmacies : créer, modifier, fonctionnalités, membre (permissions, statut, mot de passe, suppression), archiver", async ({
  page,
}) => {
  const P = {
    name: "Pharmacie Archive E2E",
    city: "Casablanca",
    address: "1 rue des Tests",
    phone: "+212 522 00 00 00",
  };
  const M = {
    name: "Gérant Archive",
    email: "gerant.archive@pharmagest.ma",
    password: "GerantE2e#1",
  };
  const base = loadState().activeUsers as number;

  await page.goto("/admin/pharmacies");
  await page.getByRole("button", { name: "Nouvelle pharmacie" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom").fill(P.name);
  await dialog.getByLabel("Ville").fill(P.city);
  const created = pageSend(page, "POST", "/admin/pharmacies");
  await dialog.getByRole("button", { name: "Créer la pharmacie" }).click();
  const c = await created;
  expectSame(
    c,
    {
      name: P.name,
      city: P.city,
      enabled_features: sorted(PHARMACY_FEATURES),
      members: [],
      archived_at: null,
    },
    "POST /admin/pharmacies",
  );
  expect(c.code, "code tiré de la ville").toMatch(/^CAS\d{4}$/);
  await page.waitForURL(new RegExp(`/admin/pharmacies/${c.id}$`));

  await test.step("modifier", async () => {
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Adresse").fill(P.address);
    await dialog.getByLabel("Téléphone").fill(P.phone);
    const patched = pageSend(page, "PATCH", `/admin/pharmacies/${c.id}`);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expectSame(
      await patched,
      {
        id: c.id,
        name: P.name,
        city: P.city,
        code: c.code,
        address: P.address,
        phone: P.phone,
      },
      "PATCH /admin/pharmacies",
    );
  });

  const features = PHARMACY_FEATURES.filter((f) => f !== "stock" && f !== "analyse");
  await test.step("fonctionnalités : Stock + Analyse coupées", async () => {
    // The page's only switches: one per feature, in ALL_FEATURES order.
    for (const f of ["stock", "analyse"]) await page.getByRole("switch").nth(ALL_FEATURES.indexOf(f)).click();
    await expect(page.getByText("2 modifications non enregistrées")).toBeVisible();
    const saved = pageSend(page, "PUT", `/admin/pharmacies/${c.id}/features`);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expectSame((await saved).enabled_features, sorted(features), "PUT features");
  });

  let memberId = 0;
  await test.step("nouveau propriétaire", async () => {
    await page.getByRole("button", { name: "Nouvel utilisateur" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nom complet").fill(M.name);
    await dialog.getByLabel("Email").fill(M.email);
    await dialog.getByLabel("Mot de passe", { exact: true }).fill(M.password);
    await dialog.getByRole("radio", { name: /^Propriétaire/ }).click();
    const made = pageSend(page, "POST", `/admin/pharmacies/${c.id}/users`);
    await dialog.getByRole("button", { name: "Créer le compte" }).click();
    const { member } = await made;
    memberId = member.id;
    expectSame(
      member,
      {
        full_name: M.name,
        email: M.email,
        role: "owner",
        status: "active",
        granted_permissions: sorted(ALL_FEATURES),
      },
      "POST users",
    );
    await dialog.getByRole("button", { name: "Fermer" }).last().click();
    expect(await activeUsersTile(page), "utilisateurs actifs +1").toBe(base + 1);
  });

  await test.step("permissions : Achats retiré (Stock / Analyse verrouillés par la pharmacie)", async () => {
    await page
      .getByRole("row", { name: new RegExp(M.email) })
      .getByRole("button", { name: "Gérer les permissions" })
      .click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("switch").nth(ALL_FEATURES.indexOf("stock"))).toBeDisabled();
    await dialog.getByRole("switch").nth(ALL_FEATURES.indexOf("achats")).click();
    const saved = pageSend(page, "PUT", `/admin/users/${memberId}/permissions`);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expectSame(
      await saved,
      {
        id: memberId,
        granted_permissions: sorted(ALL_FEATURES.filter((f) => f !== "achats")),
      },
      "PUT /admin/users/{id}/permissions",
    );
  });

  for (const [action, status, users] of [
    ["Désactiver", "inactive", base],
    ["Réactiver", "active", base + 1],
  ] as const) {
    await test.step(action, async () => {
      const patched = pageSend(page, "PATCH", `/admin/users/${memberId}/status`);
      await rowAction(page, M.email, action);
      expectSame(await patched, { id: memberId, status }, `PATCH status ${status}`);
      expect(await activeUsersTile(page), "utilisateurs actifs").toBe(users);
    });
  }

  await test.step("réinitialiser le mot de passe", async () => {
    await rowAction(page, M.email, "Réinitialiser le mot de passe");
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nouveau mot de passe", { exact: true }).fill("GerantE2e#2");
    const reset = pageSend(page, "POST", `/admin/users/${memberId}/reset-password`);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expect(await reset).toEqual({ user_id: memberId });
    await expect(dialog.getByText("GerantE2e#2")).toBeVisible();
    await dialog.getByRole("button", { name: "Fermer" }).last().click();
  });

  await test.step("supprimer le membre", async () => {
    await rowAction(page, M.email, "Supprimer");
    const deleted = pageSend(page, "DELETE", `/admin/users/${memberId}`, 204);
    await page
      .getByRole("dialog", { name: /^Supprimer définitivement Gérant Archive/ })
      .getByRole("button", { name: "Confirmer", exact: true })
      .click();
    expect(await deleted, "DELETE user → 204, corps vide").toBeNull();
    await expect(page.getByRole("row", { name: new RegExp(M.email) })).toHaveCount(0);
  });

  await test.step("archiver la pharmacie", async () => {
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    const archived = pageSend(page, "DELETE", `/admin/pharmacies/${c.id}`, 204);
    const list = pageCall<Row[]>(page, "/admin/pharmacies");
    await page
      .getByRole("dialog", {
        name: /^Supprimer définitivement Pharmacie Archive E2E/,
      })
      .getByRole("button", { name: "Confirmer", exact: true })
      .click();
    expect(await archived, "DELETE pharmacie → 204, corps vide").toBeNull();
    await page.waitForURL(/\/admin\/pharmacies$/);
    expect(
      (await list).map((p) => p.id),
      "absente de la liste",
    ).not.toContain(c.id);
    await expect(page.getByRole("row", { name: /Pharmacie Archive E2E/ }), "absente du tableau").toHaveCount(0);
  });
});

test("utilisateurs : tous les comptes, même sans pharmacie ; assigner une pharmacie", async ({ page }) => {
  // An owner left on an archived pharmacy: invisible on every pharmacy page.
  const O = {
    full_name: "Orphelin E2E",
    email: "orphelin.e2e@pharmagest.ma",
    password: "OrphelinE2e#1",
  };
  const archived = await apiPost(page, "/admin/pharmacies", {
    name: "Pharmacie Fermée E2E",
    city: "Rabat",
  });
  const { member } = await apiPost(page, `/admin/pharmacies/${archived.id}/users`, {
    ...O,
    role: "owner",
    pharmacy_id: archived.id,
  });
  await apiDelete(page, `/admin/pharmacies/${archived.id}`, 204);

  const list = pageCall<Row[]>(page, "/admin/users");
  await page.goto("/admin/pharmacies");
  await expect(page.getByRole("heading", { level: 1, name: "Pharmacies et utilisateurs" })).toBeVisible();
  await page.getByRole("tab", { name: "Utilisateurs", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=utilisateurs$/);
  const users = await list;
  const byEmail = (email: string) => users.find((u) => u.email === email);
  const all = sorted(ALL_FEATURES);
  expectSame(
    byEmail("admin@gmail.com"),
    {
      role: "admin",
      status: "active",
      pharmacy: null,
      granted_permissions: [],
    },
    "admin (seed)",
  );
  expectSame(byEmail("support@gmail.com"), { role: "support", status: "active", pharmacy: null }, "Support (seed)");
  expectSame(
    byEmail("owner@gmail.com"),
    {
      full_name: "Propriétaire Demo",
      role: "owner",
      status: "active",
      phone: "0600000001",
      pharmacy: { name: "Pharmacie Demo", code: "CAS0001", archived_at: null },
      granted_permissions: all,
    },
    "propriétaire (seed)",
  );
  expectSame(
    byEmail("owner.e2e@pharmagest.ma"),
    {
      role: "owner",
      pharmacy: { id: pharmacyId(), name: "Pharmacie E2E" },
      granted_permissions: all,
    },
    "propriétaire E2E",
  );
  expectSame(
    byEmail(O.email),
    {
      id: member.id,
      full_name: O.full_name,
      role: "owner",
      status: "active",
      pharmacy: { id: archived.id, name: "Pharmacie Fermée E2E" },
      granted_permissions: all,
    },
    "orphelin",
  );
  expect(byEmail(O.email)?.pharmacy?.archived_at, "pharmacie archivée").not.toBeNull();
  expect(new Set(users.map((u) => u.email)).size, "un compte = une ligne").toBe(users.length);

  await test.step("filtre « Sans pharmacie »", async () => {
    await page.getByRole("button", { name: "Sans pharmacie", exact: true }).click();
    for (const email of ["admin@gmail.com", "support@gmail.com", O.email]) {
      await expect(page.getByRole("row", { name: new RegExp(email) }), email).toBeVisible();
    }
    await expect(page.getByRole("row", { name: /owner@gmail\.com/ })).toHaveCount(0);
  });

  await test.step("filtre « Avec pharmacie » + recherche", async () => {
    await page.getByRole("button", { name: "Avec pharmacie", exact: true }).click();
    await expect(page.getByRole("row", { name: /owner@gmail\.com/ })).toBeVisible();
    for (const email of ["admin@gmail.com", O.email]) {
      await expect(page.getByRole("row", { name: new RegExp(email) }), email).toHaveCount(0);
    }
    await page.getByRole("button", { name: "Tous", exact: true }).click();
    const box = page.getByPlaceholder("Rechercher par nom, email, téléphone, pharmacie…");
    await box.fill(O.full_name);
    await expect(page.locator("table tbody tr"), "une seule ligne").toHaveCount(1);
    await expect(page.locator("table tbody tr")).toContainText(O.email);
    await box.fill("");
    await page.getByRole("button", { name: "Sans pharmacie", exact: true }).click();
  });

  await test.step("assigner une pharmacie (Pharmacie Demo)", async () => {
    await page
      .getByRole("row", { name: new RegExp(O.email) })
      .getByRole("button", { name: "Assigner une pharmacie" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Pharmacie", exact: true }).click();
    // Its options open on top of the page (over the dialog, never cut by it).
    await page
      .locator('[data-list="Pharmacie"]')
      .getByRole("button", { name: /· Pharmacie Demo$/ })
      .click();
    const assigned = pageSend(page, "PATCH", `/admin/users/${member.id}/pharmacy`);
    await dialog.getByRole("button", { name: "Assigner", exact: true }).click();
    expectSame(
      await assigned,
      {
        id: member.id,
        pharmacy: { name: "Pharmacie Demo", archived_at: null },
        granted_permissions: all,
      },
      "PATCH /admin/users/{id}/pharmacy",
    );
    await page.getByRole("button", { name: "Tous", exact: true }).click();
    await expect(page.getByRole("row", { name: new RegExp(O.email) })).toContainText("Pharmacie Demo");
  });

  await test.step("supprimer le compte", async () => {
    const deleted = pageSend(page, "DELETE", `/admin/users/${member.id}`, 204);
    await rowAction(page, O.email, "Supprimer");
    await page
      .getByRole("dialog", { name: /^Supprimer définitivement Orphelin E2E/ })
      .getByRole("button", { name: "Confirmer", exact: true })
      .click();
    expect(await deleted, "DELETE user → 204, corps vide").toBeNull();
    await expect(page.getByRole("row", { name: new RegExp(O.email) })).toHaveCount(0);
  });
});

/** The owner's /ventes filtered on `category` through the page (Catégorie popover);
 *  returns the rows the page got. */
async function ownerVentes(owner: Page, category: string): Promise<Row[]> {
  const first = pageCall(owner, "/ventes", { page: "1" });
  await owner.goto("/ventes");
  await first;
  const list = pageCall(owner, "/ventes", { category });
  await owner.getByRole("button", { name: "Catégorie" }).first().click();
  await owner.getByRole("checkbox", { name: category, exact: true }).check();
  const rows = (await list).data as Row[];
  await owner.keyboard.press("Escape");
  expect(rows.length, `ventes « ${category} »`).toBeGreaterThan(0);
  return rows;
}

test.describe("catégories", () => {
  // A failed check must not leave a suffix behind: later specs (15-imports) compare
  // the references with the oracle.
  test.afterEach(async ({ page }) => {
    for (const r of await apiGet<Row[]>(page, "/category-suffixes"))
      await apiDelete(page, `/category-suffixes/${r.id}`, 204);
  });

  test("catégories : suffixe créé, modifié, visible dans les ventes, supprimé", async ({ page, browser }) => {
    const owner = await (await browser.newContext({ storageState: sessionFile("owner") })).newPage();

    const list0 = pageCall(page, "/category-suffixes");
    await page.goto("/admin/categories");
    expect(await list0, "aucun suffixe au départ").toEqual([]);

    await page.getByRole("button", { name: "Nouveau mapping" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Catégorie").fill("Parapharmacie");
    await dialog.getByLabel("Suffixe").fill("-P");
    await dialog.getByRole("button", { name: "blue", exact: true }).click();
    const created = pageSend(page, "POST", "/category-suffixes", 201);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const c = await created;
    expectSame(c, { category: "Parapharmacie", suffix: "-P", color: "blue" }, "POST /category-suffixes");

    await page
      .getByRole("row", { name: /Parapharmacie/ })
      .getByRole("button", { name: "Modifier" })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Suffixe").fill("-PA");
    await dialog.getByRole("button", { name: "rose", exact: true }).click();
    const updated = pageSend(page, "PUT", `/category-suffixes/${c.id}`);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expectSame(
      await updated,
      { id: c.id, category: "Parapharmacie", suffix: "-PA", color: "rose" },
      "PUT /category-suffixes",
    );

    const withSuffix = await ownerVentes(owner, "Parapharmacie");
    expectSame(
      withSuffix.map((r) => [r.transaction_ref_final, r.transaction_ref_color]),
      withSuffix.map((r) => [`${r.transaction_ref}-PA`, "rose"]),
      "référence + suffixe dans /ventes",
    );
    await expect(owner.getByText("-PA", { exact: true }).first(), "badge « -PA » à l'écran").toBeVisible();

    const deleted = pageSend(page, "DELETE", `/category-suffixes/${c.id}`, 204);
    const list1 = pageCall(page, "/category-suffixes");
    await page
      .getByRole("row", { name: /Parapharmacie/ })
      .getByRole("button", { name: "Supprimer" })
      .click();
    await page
      .getByRole("dialog", { name: /^Supprimer le mapping/ })
      .getByRole("button", { name: "Supprimer", exact: true })
      .click();
    await deleted;
    expect(await list1, "plus de suffixe").toEqual([]);
    await expect(page.getByText("Aucun mapping configuré"), "liste vide à l'écran").toBeVisible();

    const without = await ownerVentes(owner, "Parapharmacie");
    expect(
      without.every((r) => r.transaction_ref_final === r.transaction_ref && r.transaction_ref_color === null),
      "références sans suffixe",
    ).toBe(true);
    await expect(owner.getByText("-PA", { exact: true }), "plus de badge").toHaveCount(0);
    await owner.context().close();
  });

  test("catégories : « Médicament » (accent, sans couleur) s'applique aux ventes « Médicament (x%) »", async ({
    page,
    browser,
  }) => {
    const owner = await (await browser.newContext({ storageState: sessionFile("owner") })).newPage();
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "Nouveau mapping" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Catégorie").fill("Médicament");
    await dialog.getByLabel("Suffixe").fill("-M");
    await dialog.getByRole("button", { name: "Aucune", exact: true }).click();
    const created = pageSend(page, "POST", "/category-suffixes", 201);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const c = await created;
    try {
      // cleanup even if a check fails
      expectSame(c, { category: "Médicament", suffix: "-M", color: null }, "saved as typed, accent kept, no colour");
      const rows = await ownerVentes(owner, "Médicament");
      expect(
        rows.map((r) => r.transaction_ref_final),
        "suffixe sur « Médicament (x%) »",
      ).toEqual(rows.map((r) => `${r.transaction_ref}-M`));
      await expect(owner.getByText("-M", { exact: true }).first(), "badge gris « -M » à l'écran").toBeVisible();
    } finally {
      await apiDelete(page, `/category-suffixes/${c.id}`, 204);
      await owner.context().close();
    }
  });
});

test("catalogue : liste, recherche, filtres, ajout, modification (alerte TVA), suppression, import CSV", async ({
  page,
}) => {
  const e = expected().catalog;
  const box = page.getByPlaceholder("Nom, catégorie, code-barres, laboratoire…");
  const row = (name: string) => page.getByRole("row", { name: new RegExp(name) });

  const categories = pageCall(page, "/admin/catalog/categories");
  const first = pageCall(page, "/admin/catalog", {
    sort_by: "product",
    sort_order: "asc",
    page: "1",
    limit: "25",
  });
  await page.goto("/admin/catalogue");
  await expect(page.getByRole("heading", { level: 1, name: "Catalogue médicaments" })).toBeVisible();
  expect(await categories, "catégories").toEqual(e.categories);
  const l0 = await first;
  expectSame(
    l0.pagination,
    {
      page: 1,
      limit: 25,
      total: e.total,
      total_pages: Math.ceil(e.total / 25),
    },
    "pagination",
  );
  expect(
    l0.data.map((r: Row) => r.product),
    "page 1 (tri Produit)",
  ).toEqual(e.first_page);

  await test.step("tri Produit décroissant + page suivante", async () => {
    // The « Produit » cell = name + PID on 2 lines: compare the name.
    const shows = async (res: Promise<Row>, want: Row, what: string) => {
      const r = await res;
      expectSame(r.pagination, want, `${what}: pagination`);
      await expect(page.locator("table tbody tr").first()).toContainText(r.data[0].product);
      expect(
        (await columnTexts(page, "Produit")).map((t) => t.split("\n")[0]),
        `${what}: lignes à l'écran`,
      ).toEqual(r.data.map((m: Row) => m.product));
      return r;
    };
    const sorted = (n: number) =>
      pageCall(page, "/admin/catalog", {
        sort_by: "product",
        sort_order: "desc",
        page: String(n),
        limit: "25",
      });
    let next = sorted(1);
    await page.getByRole("columnheader", { name: "Produit", exact: true }).getByRole("button").click();
    const d1 = await shows(next, { page: 1, limit: 25, total: e.total }, "tri décroissant");
    expect(d1.data[0].product, "plus le même premier produit").not.toBe(e.first_page[0]);
    next = sorted(2);
    await page.getByRole("button", { name: "Page suivante" }).click();
    await shows(next, { page: 2, limit: 25, total: e.total }, "page 2");
  });

  await test.step("recherche", async () => {
    const x = expected().exclusions.special;
    const found = pageCall(page, "/admin/catalog", { search: x.query });
    await box.fill(x.query);
    expectSame(
      (await found).data,
      [
        {
          pid: x.pid,
          product: x.product,
          category: x.category,
          product_type: null,
          laboratoire: null,
        },
      ],
      `recherche « ${x.query} »`,
    );
  });

  await test.step("filtre Type", async () => {
    await page.goto("/admin/catalogue");
    for (const [option, type, total] of [
      ["Non classés", "unclassified", e.total],
      ["Pharmacie", "pharmacie", 0],
    ] as const) {
      const res = pageCall(page, "/admin/catalog", { type });
      await page.getByRole("button", { name: /^Type/ }).click();
      await page.getByRole("button", { name: option, exact: true }).click();
      expect((await res).pagination.total, `Type ${option}`).toBe(total);
    }
  });

  await test.step("filtre Catégorie", async () => {
    await page.goto("/admin/catalogue");
    const cat = "Parapharmacie (25.000%)";
    const res = pageCall(page, "/admin/catalog", { category: cat });
    await page.getByRole("button", { name: "Catégorie" }).first().click();
    await page.getByRole("checkbox", { name: cat, exact: true }).check();
    expect((await res).pagination.total, cat).toBe(e.by_category[cat] ?? 0);
  });

  const NEW = {
    product: "E2E NOUVEAU PRODUIT",
    category: "Hygiène (30.000%)",
    laboratoire: "Laboratoire E2E",
    tva: "TVA (20.00%)",
    pph: 20,
    ppv: 30,
    barcode1: "6130000000001",
  };
  let medId = 0;
  await test.step("ajouter", async () => {
    await page.goto("/admin/catalogue");
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Nom du produit *", { exact: true }).fill(NEW.product);
    await form.getByLabel("Catégorie", { exact: true }).fill(NEW.category);
    await form.getByLabel("Laboratoire", { exact: true }).fill(NEW.laboratoire);
    await form.getByLabel("TVA", { exact: true }).fill(NEW.tva);
    await form.getByLabel("PPH", { exact: true }).fill(String(NEW.pph));
    await form.getByLabel("PPV", { exact: true }).fill(String(NEW.ppv));
    await form.getByLabel("Code-barres 1", { exact: true }).fill(NEW.barcode1);
    const created = pageSend(page, "POST", "/admin/catalog", 201);
    await form.getByRole("button", { name: "Ajouter", exact: true }).click();
    const m = await created;
    medId = m.id;
    expectSame(m, { pid: NEW.barcode1, ...NEW, barcode2: null, product_type: null }, "POST /admin/catalog");
  });

  await test.step("modifier : Médicament + TVA 20 % → alerte, confirmer", async () => {
    const found = pageCall(page, "/admin/catalog", { search: NEW.product });
    await box.fill(NEW.product);
    await found;
    await row(NEW.product).getByRole("button", { name: "Modifier" }).click();
    const form = page.getByRole("dialog").filter({ hasText: "Modifier le médicament" });
    await form.getByLabel("Catégorie", { exact: true }).fill("Médicament (30.000%)");
    await form.getByRole("button", { name: "Pharmacie", exact: true }).click();
    await form.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const updated = pageSend(page, "PUT", `/admin/catalog/${medId}`);
    await page
      .getByRole("dialog", { name: /exonérés/ })
      .getByRole("button", { name: "Confirmer", exact: true })
      .click();
    expectSame(
      await updated,
      {
        id: medId,
        pid: NEW.barcode1,
        product: NEW.product,
        category: "Médicament (30.000%)",
        tva: NEW.tva,
        product_type: "pharmacie",
      },
      "PUT /admin/catalog",
    );
  });

  await test.step("supprimer", async () => {
    const deleted = pageSend(page, "DELETE", `/admin/catalog/${medId}`, 204);
    await row(NEW.product).getByRole("button", { name: "Supprimer" }).click();
    await page
      .getByRole("dialog", { name: "Supprimer ce médicament ?" })
      .getByRole("button", { name: "Supprimer", exact: true })
      .click();
    await deleted;
    await expect(row(NEW.product)).toHaveCount(0);
  });

  await test.step("supprimer un médicament vendu → refusé (409) + message", async () => {
    const x = expected().exclusions.special;
    const found = pageCall(page, "/admin/catalog", { search: x.query });
    await page.goto("/admin/catalogue");
    await box.fill(x.query);
    const med = (await found).data[0];
    const refused = pageSend(page, "DELETE", `/admin/catalog/${med.id}`, 409);
    await page.getByRole("row", { name: x.product }).getByRole("button", { name: "Supprimer" }).click();
    await page
      .getByRole("dialog", { name: "Supprimer ce médicament ?" })
      .getByRole("button", { name: "Supprimer", exact: true })
      .click();
    expect((await refused).code, "code d'erreur").toBe("medicamentInUse");
    await expect(
      page.getByText("Ce médicament est utilisé dans des ventes, achats ou stocks : suppression impossible."),
    ).toBeVisible();
    await expect(page.getByRole("row", { name: x.product })).toHaveCount(1);
  });

  await test.step("même refus en espagnol → message traduit (errors.medicamentInUse)", async () => {
    const x = expected().exclusions.special;
    await page.getByRole("button", { name: "Espagnol", exact: true }).click();
    try {
      const found = pageCall(page, "/admin/catalog", { search: x.query });
      await page.goto("/admin/catalogue");
      await page.getByPlaceholder("Nombre, categoría, código de barras, laboratorio…").fill(x.query);
      await found;
      const refused = pageSend(page, "DELETE", /^\/v1\/admin\/catalog\/\d+$/, 409);
      await page.getByRole("row", { name: x.product }).getByRole("button", { name: "Eliminar" }).click();
      await page
        .getByRole("dialog", { name: "¿Eliminar este medicamento?" })
        .getByRole("button", { name: "Eliminar", exact: true })
        .click();
      expect((await refused).code, "code d'erreur").toBe("medicamentInUse");
      await expect(
        page.getByText("Este medicamento se usa en ventas, compras o stock: no se puede eliminar."),
      ).toBeVisible();
    } finally {
      await page.getByRole("button", { name: "Francés", exact: true }).click();
    }
  });

  await test.step("import CSV du catalogue (5 nouveaux produits)", async () => {
    await page.getByRole("button", { name: "Importer CSV" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles(resolve(REPO_DIR, expected().files.catalog.path));
    const imported = pageSend(page, "POST", "/uploads/catalog");
    await dialog.getByRole("button", { name: "Importer", exact: true }).click();
    expectSame(await imported, e.import, "POST /uploads/catalog");
    await page.keyboard.press("Escape");

    const found = pageCall(page, "/admin/catalog", { search: "E2E CATALOGUE" });
    await box.fill("E2E CATALOGUE");
    expectSameSet(
      (await found).data,
      e.items.map((it: Row) => ({
        ...it,
        pid: it.barcode1,
        product_type: "parapharmacie",
      })),
      (r) => r.product,
      "produits importés",
    );
  });
});
