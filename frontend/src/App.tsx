import { Routes, Route } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { RequireFeature } from "@/components/layout/RequireFeature";
import { RequireGuest } from "@/components/layout/RequireGuest";
import { RequireRole } from "@/components/layout/RequireRole";
import CataloguePage from "@/pages/admin/catalogue";
import AdminCategoriesPage from "@/pages/admin/categories";
import AdminDevelopersPage from "@/pages/admin/developers";
import AdminPharmaciesIndex from "@/pages/admin/pharmacies";
import AdminPharmacyDetail from "@/pages/admin/pharmacies/detail";
import DevDashboardPage from "@/pages/dev";
import DevExportsPage from "@/pages/dev/exports";
import DevEditorPage from "@/pages/dev/requests/$id.editor";
import DevRequestDetailPage from "@/pages/dev/requests/$id";
import OwnerEmployeesPage from "@/pages/owner/employees";
import StoreWebsitePage from "@/pages/store-website";
import StoreWebsiteNewPage from "@/pages/store-website/new";
import ProduitsSpeciauxPage from "@/pages/produits-speciaux";
import ForgotPasswordPage from "@/pages/auth/forgotPassword";
import MePage from "@/pages/auth/me";
import SetPasswordPage from "@/pages/auth/setPassword";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import NotFoundPage from "@/pages/notFound";
import ImportsPage from "@/pages/imports";
import RapportPage from "@/pages/rapport";
import AchatsPage from "@/pages/achats";
import AlertesPage from "@/pages/alertes";
import AnalysePage from "@/pages/analyse";
import ComptabilitePage from "@/pages/comptabilite";
import StockPage from "@/pages/stock";
import UploadFilePage from "@/pages/upload-file";
import VentesPage from "@/pages/ventes";
import { ROLES, ROUTES } from "@/types";

export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.HOME} element={<HomePage />} />

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
          <Route path={ROUTES.ADMIN_DEVELOPERS} element={<AdminDevelopersPage />} />
        </Route>

        <Route element={<RequireRole role={ROLES.OWNER} />}>
          <Route path={ROUTES.OWNER_EMPLOYEES}   element={<OwnerEmployeesPage />} />
          <Route path={ROUTES.STORE_WEBSITE}     element={<StoreWebsitePage />} />
          <Route path={ROUTES.STORE_WEBSITE_NEW} element={<StoreWebsiteNewPage />} />
        </Route>

        {/* Developer-only routes — admin can also access for support. */}
        <Route element={<RequireRole role={[ROLES.DEVELOPER, ROLES.ADMIN]} />}>
          <Route path={ROUTES.DEV_DASHBOARD} element={<DevDashboardPage />} />
          <Route path={ROUTES.DEV_REQUEST}   element={<DevRequestDetailPage />} />
          <Route path={ROUTES.DEV_EDITOR}    element={<DevEditorPage />} />
          <Route path={ROUTES.DEV_EXPORTS}   element={<DevExportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}