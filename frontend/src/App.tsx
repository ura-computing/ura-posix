import { Routes, Route } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { RequireGuest } from "@/components/layout/RequireGuest";
import { RequireRole } from "@/components/layout/RequireRole";
import CataloguePage from "@/pages/admin/catalogue";
import ForgotPasswordPage from "@/pages/auth/forgotPassword";
import MePage from "@/pages/auth/me";
import SetPasswordPage from "@/pages/auth/setPassword";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import NotFoundPage from "@/pages/notFound";
import ParametresPage from "@/pages/parametres";
import RapportPage from "@/pages/rapport";
import AchatsPage from "@/pages/achats";
import AlertesPage from "@/pages/alertes";
import AnalysePage from "@/pages/analyse";
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
        <Route path={ROUTES.RAPPORT}     element={<RapportPage />} />
        <Route path={ROUTES.UPLOAD_FILE} element={<UploadFilePage />} />
        <Route path={ROUTES.ACHATS}      element={<AchatsPage />} />
        <Route path={ROUTES.VENTES}      element={<VentesPage />} />
        <Route path={ROUTES.STOCK}       element={<StockPage />} />
        <Route path={ROUTES.ALERTES}     element={<AlertesPage />} />
        <Route path={ROUTES.ANALYSES}    element={<AnalysePage />} />
        <Route path={ROUTES.PARAMETRES}  element={<ParametresPage />} />
        <Route path={ROUTES.ME}          element={<MePage />} />

        <Route element={<RequireRole role={ROLES.ADMIN} />}>
          <Route path={ROUTES.ADMIN_CATALOGUE} element={<CataloguePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}