import { lazy, Suspense, useEffect } from "react";
import { Routes, Route } from "react-router-dom";

import { AppLayout } from "@/_components/templates/AppLayout";
import { RequireFeature } from "@/_components/routing/RequireFeature";
import { RequireGuest } from "@/_components/routing/RequireGuest";
import { RequireRole } from "@/_components/routing/RequireRole";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/auth/login";
import NotFoundPage from "@/pages/auth/not-found";
import { ROLES, ROUTES, STAFF } from "@/types";

// Every other page has its own JS file: the first screen downloads one page,
// not the whole app. The others download in the background right after.
const PAGES = {
  CataloguePage: () => import("@/pages/admin/catalogue"),
  AdminCategoriesPage: () => import("@/pages/admin/categories"),
  AdminPharmaciesIndex: () => import("@/pages/admin/pharmacies"),
  MyStorePage: () => import("@/pages/store/my-store"),
  StoreRequestsPage: () => import("@/pages/store/requests"),
  StoreRequestPage: () => import("@/pages/store/request"),
  StoreEditorPage: () => import("@/pages/store/editor"),
  StorePreviewPage: () => import("@/pages/store/preview"),
  AdminPharmacyDetail: () => import("@/pages/admin/pharmacies/detail"),
  OwnerEmployeesPage: () => import("@/pages/team"),
  HistoryPage: () => import("@/pages/history"),
  ProduitsSpeciauxPage: () => import("@/pages/accounting/produits-speciaux"),
  ForgotPasswordPage: () => import("@/pages/auth/forgot-password"),
  SignupPage: () => import("@/pages/auth/signup"),
  MePage: () => import("@/pages/auth/me"),
  SetPasswordPage: () => import("@/pages/auth/set-password"),
  ImportsPage: () => import("@/pages/imports/history"),
  SobrusPage: () => import("@/pages/imports/sobrus"),
  RapportPage: () => import("@/pages/rapport"),
  AchatsPage: () => import("@/pages/operations/achats"),
  AlertesPage: () => import("@/pages/analytics/alertes"),
  AnalysePage: () => import("@/pages/analytics/analyses"),
  ComptabilitePage: () => import("@/pages/accounting/comptabilite"),
  StockPage: () => import("@/pages/analytics/stock"),
  ProduitsPage: () => import("@/pages/products/list"),
  ProduitPage: () => import("@/pages/products/sheet"),
  UploadFilePage: () => import("@/pages/imports/upload"),
  VentesPage: () => import("@/pages/operations/ventes"),
};
const CataloguePage = lazy(PAGES.CataloguePage);
const AdminCategoriesPage = lazy(PAGES.AdminCategoriesPage);
const AdminPharmaciesIndex = lazy(PAGES.AdminPharmaciesIndex);
const AdminPharmacyDetail = lazy(PAGES.AdminPharmacyDetail);
const OwnerEmployeesPage = lazy(PAGES.OwnerEmployeesPage);
const HistoryPage = lazy(PAGES.HistoryPage);
const ProduitsSpeciauxPage = lazy(PAGES.ProduitsSpeciauxPage);
const StoreRequestsPage = lazy(PAGES.StoreRequestsPage);
const StoreRequestPage = lazy(PAGES.StoreRequestPage);
const StoreEditorPage = lazy(PAGES.StoreEditorPage);
const StorePreviewPage = lazy(PAGES.StorePreviewPage);
const MyStorePage = lazy(PAGES.MyStorePage);
const ForgotPasswordPage = lazy(PAGES.ForgotPasswordPage);
const SignupPage = lazy(PAGES.SignupPage);
const MePage = lazy(PAGES.MePage);
const SetPasswordPage = lazy(PAGES.SetPasswordPage);
const ImportsPage = lazy(PAGES.ImportsPage);
const SobrusPage = lazy(PAGES.SobrusPage);
const RapportPage = lazy(PAGES.RapportPage);
const AchatsPage = lazy(PAGES.AchatsPage);
const AlertesPage = lazy(PAGES.AlertesPage);
const AnalysePage = lazy(PAGES.AnalysePage);
const ComptabilitePage = lazy(PAGES.ComptabilitePage);
const StockPage = lazy(PAGES.StockPage);
const ProduitsPage = lazy(PAGES.ProduitsPage);
const ProduitPage = lazy(PAGES.ProduitPage);
const UploadFilePage = lazy(PAGES.UploadFilePage);
const VentesPage = lazy(PAGES.VentesPage);

export default function App() {
  // 2 s after the first screen: fetch every page's file, so later clicks don't wait.
  useEffect(() => {
    const t = window.setTimeout(() => {
      for (const load of Object.values(PAGES)) void load();
    }, 2000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path={ROUTES.HOME} element={<HomePage />} />

        {/* A pharmacy's online store as customers will see it (no app chrome, no login): the editor shows it. */}
        <Route path={ROUTES.STORE_PREVIEW} element={<StorePreviewPage />} />

        {/* Auth routes: only accessible to UNauthenticated visitors */}
        <Route element={<RequireGuest />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
          <Route path={ROUTES.SIGNUP} element={<SignupPage />} />
          <Route path={ROUTES.SET_PASSWORD} element={<SetPasswordPage />} />
        </Route>

        {/* App routes: only accessible to AUTHENTICATED users */}
        <Route element={<AppLayout />}>
          <Route path={ROUTES.ME} element={<MePage />} />

          {/* Feature-gated routes — admin bypasses; non-admin without the
              feature in their effective permission set redirects to /404. */}
          <Route element={<RequireFeature feature="rapports" />}>
            <Route path={ROUTES.RAPPORT} element={<RapportPage />} />
          </Route>
          <Route element={<RequireFeature feature="import" />}>
            <Route path={ROUTES.IMPORTS} element={<ImportsPage />} />
            <Route path={ROUTES.UPLOAD_FILE} element={<UploadFilePage />} />
          </Route>
          <Route element={<RequireFeature feature="sobrus" />}>
            <Route element={<RequireRole role={ROLES.OWNER} />}>
              <Route path={ROUTES.SOBRUS} element={<SobrusPage />} />
            </Route>
          </Route>
          {/* The pharmacy data pages: an owner or an employee (the admin reads them in « Tableau de bord » per pharmacy) → else the 404 inside the layout. */}
          <Route element={<RequireRole role={[ROLES.OWNER, ROLES.EMPLOYEE]} />}>
            <Route element={<RequireFeature feature="alertes" />}>
              <Route path={ROUTES.ALERTES} element={<AlertesPage />} />
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
            <Route element={<RequireFeature feature="produits" />}>
              <Route path={ROUTES.PRODUITS} element={<ProduitsPage />} />
              <Route path={ROUTES.PRODUIT} element={<ProduitPage />} />
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
          </Route>

          <Route element={<RequireRole role={STAFF} />}>
            <Route path={ROUTES.ADMIN_CATALOGUE} element={<CataloguePage />} />
            <Route path={ROUTES.ADMIN_CATEGORIES} element={<AdminCategoriesPage />} />
            <Route path={ROUTES.ADMIN_PHARMACIES} element={<AdminPharmaciesIndex />} />
            <Route path={ROUTES.ADMIN_PHARMACY} element={<AdminPharmacyDetail />} />
            <Route path={ROUTES.STORE_REQUESTS} element={<StoreRequestsPage />} />
            <Route path={ROUTES.STORE_REQUEST} element={<StoreRequestPage />} />
            <Route path={ROUTES.STORE_EDITOR} element={<StoreEditorPage />} />
          </Route>

          <Route element={<RequireRole role={ROLES.OWNER} />}>
            <Route path={ROUTES.OWNER_EMPLOYEES} element={<OwnerEmployeesPage />} />
            <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
            <Route path={ROUTES.STORE_WEBSITE} element={<MyStorePage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
