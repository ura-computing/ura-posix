import { Routes, Route } from "react-router-dom";

import { AppLayout } from "@/_components/AppLayout";
import { RequireFeature } from "@/_components/RequireFeature";
import { RequireGuest } from "@/_components/RequireGuest";
import { RequireRole } from "@/_components/RequireRole";
import CataloguePage from "@/pages/admin/catalogue";
import AdminCategoriesPage from "@/pages/admin/categories";
import AdminPharmaciesIndex from "@/pages/admin/pharmacies";
import AdminPharmacyDetail from "@/pages/admin/pharmacies/detail";
import OwnerEmployeesPage from "@/pages/team";
import ProduitsSpeciauxPage from "@/pages/accounting/produits-speciaux";
// HIDDEN 2026-07-03 — the "Ma boutique en ligne" (owner) + developer editor +
// admin/developers surfaces are wired end-to-end but not ready to ship. Restore
// these imports and the matching Route blocks below when the feature is done.
// import AdminDevelopersPage from "@/pages/admin/developers";
// import DevDashboardPage from "@/pages/store/dev";
// import DevExportsPage from "@/pages/store/dev/exports";
// import DevEditorPage from "@/pages/store/dev/requests/$id.editor";
// import DevRequestDetailPage from "@/pages/store/dev/requests/$id";
// import StoreWebsitePage from "@/pages/store/store-website";
// import StoreWebsiteNewPage from "@/pages/store/store-website/new";
import ForgotPasswordPage from "@/pages/auth/forgot-password";
import MePage from "@/pages/auth/me";
import SetPasswordPage from "@/pages/auth/set-password";
import HomePage from "@/pages/auth/home";
import LoginPage from "@/pages/auth/login";
import NotFoundPage from "@/pages/auth/not-found";
// HIDDEN 2026-07-03 — public preview page renders customization data from the
// hidden feature. Restore alongside the block below.
// import StorePreviewPage from "@/pages/store/preview";
import ImportsPage from "@/pages/imports/history";
import RapportPage from "@/pages/dashboard/rapport";
import AchatsPage from "@/pages/operations/achats";
import AlertesPage from "@/pages/analytics/alertes";
import AnalysePage from "@/pages/analytics/analyses";
import ComptabilitePage from "@/pages/accounting/comptabilite";
import StockPage from "@/pages/analytics/stock";
import UploadFilePage from "@/pages/imports/upload";
import VentesPage from "@/pages/operations/ventes";
import { ROLES, ROUTES } from "@/types";

export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<HomePage />} />

      {/* HIDDEN 2026-07-03 — public template preview belongs to the hidden
          store-website feature. Restore when the feature ships.
      <Route path={ROUTES.STORE_PREVIEW} element={<StorePreviewPage />} />
      */}

      {/* Auth routes: only accessible to UNauthenticated visitors */}
      <Route element={<RequireGuest />}>
        <Route path={ROUTES.LOGIN}           element={<LoginPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.SET_PASSWORD}    element={<SetPasswordPage />} />
      </Route>

      {/* App routes: only accessible to AUTHENTICATED users */}
      <Route element={<AppLayout />}>
        <Route path={ROUTES.ME}          element={<MePage />} />

        {/* Feature-gated routes — admin bypasses; non-admin without the
            feature in their effective permission set redirects to /404. */}
        <Route element={<RequireFeature feature="rapports" />}>
          <Route path={ROUTES.RAPPORT}   element={<RapportPage />} />
        </Route>
        <Route element={<RequireFeature feature="alertes" />}>
          <Route path={ROUTES.ALERTES}   element={<AlertesPage />} />
        </Route>
        <Route element={<RequireFeature feature="import" />}>
          <Route path={ROUTES.IMPORTS}     element={<ImportsPage />} />
          <Route path={ROUTES.UPLOAD_FILE} element={<UploadFilePage />} />
        </Route>
        <Route element={<RequireFeature feature="achats" />}>
          <Route path={ROUTES.ACHATS} element={<AchatsPage />} />
        </Route>
        <Route element={<RequireFeature feature="ventes" />}>
          <Route path={ROUTES.VENTES} element={<VentesPage />} />
        </Route>
        <Route element={<RequireFeature feature="stock" />}>
          <Route path={ROUTES.STOCK} element={<StockPage />} />
        </Route>
        <Route element={<RequireFeature feature="analyse" />}>
          <Route path={ROUTES.ANALYSES} element={<AnalysePage />} />
        </Route>
        <Route element={<RequireFeature feature="accounting" />}>
          <Route path={ROUTES.COMPTABILITE} element={<ComptabilitePage />} />
        </Route>
        <Route element={<RequireFeature feature="special_products" />}>
          <Route path={ROUTES.PRODUITS_SPECIAUX} element={<ProduitsSpeciauxPage />} />
        </Route>

        <Route element={<RequireRole role={ROLES.ADMIN} />}>
          <Route path={ROUTES.ADMIN_CATALOGUE}  element={<CataloguePage />} />
          <Route path={ROUTES.ADMIN_CATEGORIES} element={<AdminCategoriesPage />} />
          <Route path={ROUTES.ADMIN_PHARMACIES} element={<AdminPharmaciesIndex />} />
          <Route path={ROUTES.ADMIN_PHARMACY}   element={<AdminPharmacyDetail />} />
          {/* HIDDEN 2026-07-03 — admin/developers panel.
          <Route path={ROUTES.ADMIN_DEVELOPERS} element={<AdminDevelopersPage />} />
          */}
        </Route>

        <Route element={<RequireRole role={ROLES.OWNER} />}>
          <Route path={ROUTES.OWNER_EMPLOYEES}   element={<OwnerEmployeesPage />} />
          {/* HIDDEN 2026-07-03 — "Ma boutique en ligne" for owners.
          <Route path={ROUTES.STORE_WEBSITE}     element={<StoreWebsitePage />} />
          <Route path={ROUTES.STORE_WEBSITE_NEW} element={<StoreWebsiteNewPage />} />
          */}
        </Route>

        {/* HIDDEN 2026-07-03 — developer-only routes (queue + request detail +
            editor + exports). Restore when the feature is complete.
        <Route element={<RequireRole role={[ROLES.DEVELOPER, ROLES.ADMIN]} />}>
          <Route path={ROUTES.DEV_DASHBOARD} element={<DevDashboardPage />} />
          <Route path={ROUTES.DEV_REQUEST}   element={<DevRequestDetailPage />} />
          <Route path={ROUTES.DEV_EDITOR}    element={<DevEditorPage />} />
          <Route path={ROUTES.DEV_EXPORTS}   element={<DevExportsPage />} />
        </Route>
        */}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}