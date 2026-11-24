# Frontend by role — detail (Claude's working notes; the short version is PLAN.md §1)

## Frontend by role + clean code (decided 2026-11-24) — next, tests only at the end

**Order:** 1.1 → 1.2 → 1.3 → 1.4 → 1.5 (E2E + `make tests` last, then commit + push).

### 1.1 Folders

| Folder | Holds |
|---|---|
| `pages/admin/` | the admin's pages: thin files (route guard + the page body from `_components/pages/`) |
| `pages/support/` | the Support's pages (same bodies as the admin's + « Boutiques en ligne ») |
| `pages/owner/` | the owner's pages |
| `pages/employee/` | the employee's pages |
| `pages/common/` | no single role: home, login, sign-up, forgot / set password, Mon compte, 404, the public store preview |
| `_components/pages/` | the body of every page used by 2+ roles (Ventes: owner + employee; Catalogue: admin + Support), with its hooks and its own parts |
| `_components/` atoms / molecules / organisms / templates | unchanged rule: reusable pieces |
| `storefront/` | the online store's code (5 models + the downloaded site's app): not app UI, shipped in the ZIP |

### 1.2 Addresses: every role its prefix

| Role | Pages |
|---|---|
| admin | `/admin/rapport`, `/admin/pharmacies`, `/admin/pharmacies/:id`, `/admin/catalogue`, `/admin/categories`, `/admin/imports` |
| support | `/support/rapport`, `/support/pharmacies`, `/support/pharmacies/:id`, `/support/catalogue`, `/support/categories`, `/support/imports`, `/support/boutiques`, `/support/boutiques/:id`, `/support/boutiques/:id/editeur` |
| owner | `/owner/rapport`, `/owner/achats`, `/owner/ventes`, `/owner/stock`, `/owner/produits`, `/owner/produits/:id`, `/owner/analyses`, `/owner/alertes`, `/owner/comptabilite`, `/owner/produits-speciaux`, `/owner/imports`, `/owner/upload-file`, `/owner/sobrus`, `/owner/equipe`, `/owner/historique`, `/owner/ma-boutique` |
| employee | `/employee/rapport`, `/employee/achats`, `/employee/ventes`, `/employee/stock`, `/employee/produits`, `/employee/produits/:id`, `/employee/analyses`, `/employee/alertes`, `/employee/comptabilite`, `/employee/produits-speciaux`, `/employee/imports`, `/employee/upload-file` (each still behind its permission) |
| common | `/`, `/login`, `/signup`, `/forgot-password`, `/set-password`, `/compte`, `/preview/:template/:page` |

- Routes are data, not JSX: one table per role, `App.tsx` maps over it (no hand-written `<Route>` blocks). The
  sidebar reads the same table (no second list in `nav.ts`).

  ```ts
  // routes/owner.ts
  export const OWNER_ROUTES: AppRoute[] = [
    { path: "/owner/ventes", page: "VentesPage", feature: "ventes", nav: { label: "nav.ventes", icon: TrendingUp, group: "exploitation" } },
    { path: "/owner/produits/:id", page: "ProduitPage", feature: "produits" }, // no nav: reached from the list
    { path: "/owner/equipe", page: "EquipePage", nav: { label: "nav.equipe", icon: UsersRound, group: "gestion" } },
  ];
  // App.tsx
  {ROLE_ROUTES.map(({ role, routes }) => (
    <Route key={role} element={<RequireRole role={role} />}>
      {routes.map((r) => (
        <Route key={r.path} element={<RequireFeature feature={r.feature} />}>
          <Route path={r.path} element={<LazyPage name={r.page} />} />
        </Route>
      ))}
    </Route>
  ))}
  ```
- Notification links (backend `notifications/service.py`) and emails point to the role's address.
- API paths do not change (the API checks the role itself).

### 1.3 Remove made-up abstractions

| Find | Replace with |
|---|---|
| `STAFF`, `isStaff()` (frontend), `STAFF_ROLES`, `is_staff()` (backend) and every caller | explicit `ROLES.ADMIN` / `ROLES.SUPPORT` / `ROLES.OWNER` / `ROLES.EMPLOYEE` checks |
| any other helper that only renames / groups constants | the constants themselves |

### 1.4 Store models

4 more models (Classique, Moderne, Apothéose, Élégance) from free online templates, on one storefront design system.

### 1.5 Tests (last)

Every E2E path updated to 1.2; new specs: online store (owner request + settings, Support queue + editor + download, site
API vs the oracle `store`), Support role, notifications; gates without the store allowlist; then `make tests` green →
commit + push.

---

