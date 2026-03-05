import { Authenticated, Refine } from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import routerProvider, {
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes } from "react-router";
import "./App.css";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import {
  BarChart3,
  LayoutDashboard,
  ShoppingCart,
  ShoppingBasket,
  TriangleAlert,
  Settings,
} from "lucide-react";
import { Layout } from "./components/refine-ui/layout/layout";
import Dashboard from "./pages/dashboard";
import DashboardUploadFile from "./pages/dashboard/upload-file";
import { dataProvider } from "./providers/data";
import { authProvider } from "./providers/auth";
import { Login } from "./pages/login";
import { Register } from "./pages/register";
import AchatList from "./pages/achat/list";
import VentesList from "./pages/ventes/index";
import StockList from "./pages/stock/list";
import ParametresList from "./pages/parametres/list";
import RapportsPage from "./pages/rapports";
import ProfileSetup from "./pages/profile/setup";
import ProfilePage from "./pages/profile/index";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RefineKbarProvider>
          <ThemeProvider>
            <DevtoolsProvider>
              <Refine
                dataProvider={dataProvider}
                authProvider={authProvider}
                notificationProvider={useNotificationProvider()}
                routerProvider={routerProvider}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  projectId: "kkWuv7-GgBIfw-P8CGy0",
                }}
                resources={[
                  {
                    name: "dashboard",
                    list: "/",
                    meta: { label: "Tableau de bord", icon: <LayoutDashboard /> },
                  },
                  {
                    name: "achat",
                    list: "/achat",
                    meta: { label: "achat", icon: <ShoppingCart /> },
                  },
                  {
                    name: "ventes",
                    list: "/ventes",
                    meta: { label: "Ventes", icon: <ShoppingBasket /> },
                  },
                  {
                    name: "stock",
                    list: "/stock",
                    meta: { label: "Alertes Stock", icon: <TriangleAlert /> },
                  },
                  {
                    name: "rapports",
                    list: "/rapports",
                    meta: { label: "Rapports", icon: <BarChart3 /> },
                  },
                  {
                    name: "parametres",
                    list: "/parametres",
                    meta: { label: "Paramètres", icon: <Settings /> },
                  },
                ]}
              >
                <Routes>
                  {/* Public-only routes */}
                  <Route
                    element={
                      <Authenticated key="public-routes" fallback={<Outlet />}>
                        <NavigateToResource fallbackTo="/" />
                      </Authenticated>
                    }
                  >
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                  </Route>

                  {/* Profile setup — requires auth but outside main layout */}
                  <Route
                    element={
                      <Authenticated key="profile-setup" fallback={<Login />}>
                        <Outlet />
                      </Authenticated>
                    }
                  >
                    <Route path="/profile/setup" element={<ProfileSetup />} />
                  </Route>

                  {/* Private routes with sidebar layout */}
                  <Route
                    element={
                      <Authenticated key="private-routes" fallback={<Login />}>
                        <Layout>
                          <Outlet />
                        </Layout>
                      </Authenticated>
                    }
                  >
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard/upload-file" element={<DashboardUploadFile />} />
                    <Route path="/achat" element={<AchatList />} />
                    <Route path="/ventes" element={<VentesList />} />
                    <Route path="/stock" element={<StockList />} />
                    <Route path="/rapports" element={<RapportsPage />} />
                    <Route path="/parametres" element={<ParametresList />} />
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>
                </Routes>

                <Toaster />
                <RefineKbar />
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>
            </DevtoolsProvider>
          </ThemeProvider>
        </RefineKbarProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
