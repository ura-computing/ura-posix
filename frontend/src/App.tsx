import { Authenticated, Refine, useGetIdentity } from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import routerProvider, {
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Outlet, Route, Routes, useLocation, useNavigate } from "react-router";
import { useEffect } from "react";
import "./App.css";
import { Toaster } from "./components/refine-ui/notification/toaster";
import { useNotificationProvider } from "./components/refine-ui/notification/use-notification-provider";
import { ThemeProvider } from "./components/refine-ui/theme/theme-provider";
import { Layout } from "./components/refine-ui/layout/layout";
import { dataProvider } from "./providers/data";
import { authProvider } from "./providers/auth";
import { Login } from "./pages/login";
import { routes, resources } from "./routes";
import { useStatusPoller } from "./hooks/use-status-poller";
import type { User } from "./types";

// Blocks navigation to any route other than "/" for pending (not yet active) accounts.
// Also polls the backend while pending so approval is reflected immediately.
function PendingGuard() {
  const { data: identity } = useGetIdentity<User>();
  const location = useLocation();
  const navigate = useNavigate();

  useStatusPoller(identity);

  useEffect(() => {
    if (identity && identity.status !== "active" && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [identity, location.pathname, navigate]);

  return <Outlet />;
}

const queryClient = new QueryClient();

function App() {
  const publicRoutes = routes.filter((r) => !r.requireAuth);
  const authRoutesNoLayout = routes.filter((r) => r.requireAuth && r.layout === "none");
  const authRoutesWithLayout = routes.filter((r) => r.requireAuth && r.layout === "sidebar");

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RefineKbarProvider>
          <ThemeProvider defaultTheme="light">
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
                resources={resources}
              >
                <Routes>
                  {/* Public routes (no auth required) */}
                  <Route
                    element={
                      <Authenticated key="public-routes" fallback={<Outlet />}>
                        <NavigateToResource fallbackTo="/" />
                      </Authenticated>
                    }
                  >
                    {publicRoutes.map((route) => (
                      <Route key={route.path} path={route.path} element={route.element} />
                    ))}
                  </Route>

                  {/* Auth routes without sidebar layout */}
                  <Route
                    element={
                      <Authenticated key="auth-no-layout" fallback={<Login />}>
                        <Outlet />
                      </Authenticated>
                    }
                  >
                    {authRoutesNoLayout.map((route) => (
                      <Route key={route.path} path={route.path} element={route.element} />
                    ))}
                  </Route>

                  {/* Auth routes with sidebar layout */}
                  <Route
                    element={
                      <Authenticated key="auth-with-layout" fallback={<Login />}>
                        <Layout>
                          <PendingGuard />
                        </Layout>
                      </Authenticated>
                    }
                  >
                    {authRoutesWithLayout.map((route) => (
                      <Route key={route.path} path={route.path} element={route.element} />
                    ))}
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
