import { Authenticated, Refine, useLogout } from "@refinedev/core";
import { DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import routerProvider, {
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router";
import { useEffect, type ReactNode } from "react";
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
import { useMe } from "./hooks/use-me";
import type { UserRole } from "./types";

// Blocks navigation to any route other than "/" for pending (not yet active) accounts.
// Also polls the backend while pending so approval is reflected immediately.
function PendingGuard() {
  const { data: identity } = useMe();
  const location = useLocation();
  const navigate = useNavigate();

  useStatusPoller(identity);
  useExtensionLogoutSync();

  useEffect(() => {
    if (identity && identity.status !== "active" && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [identity, location.pathname, navigate]);

  return <Outlet />;
}

// Listens for APCM_FORCE_LOGOUT message fired by the extension's content script
// when the user logs out from the extension popup.
function useExtensionLogoutSync() {
  const { mutate: logout } = useLogout();
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "APCM_FORCE_LOGOUT") logout();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [logout]);
}

function RoleGuard({ allowed, permission, children }: { allowed?: UserRole[]; permission?: string; children: ReactNode }) {
  const { data: identity, isLoading } = useMe();
  if (isLoading || !identity) return null;
  if (allowed && !allowed.includes(identity.role as UserRole)) return <Navigate to="/" replace />;
  if (permission && identity.permissions?.[permission] === false) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const queryClient = new QueryClient();

function App() {
  const universalRoutes = routes.filter((r) => r.layout === "universal");
  const publicRoutes = routes.filter((r) => !r.requireAuth && r.layout !== "universal");
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
                  projectId: import.meta.env.VITE_REFINE_PROJECT_ID ?? "kkWuv7-GgBIfw-P8CGy0",
                }}
                resources={resources}
              >
                <Routes>
                  {/* Universal routes (accessible to all, no auth wrapper) */}
                  {universalRoutes.map((route) => (
                    <Route key={route.path} path={route.path} element={route.element} />
                  ))}

                  {/* Public routes (no auth required, redirect to dashboard if authenticated) */}
                  <Route
                    element={
                      <Authenticated key="public-routes" fallback={<Outlet />}>
                        <NavigateToResource fallbackTo="/dashboard" />
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
                      <Authenticated key="auth-with-layout" fallback={<Navigate to="/login" replace />}>
                        <Layout>
                          <PendingGuard />
                        </Layout>
                      </Authenticated>
                    }
                  >
                    {authRoutesWithLayout.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={
                          <RoleGuard allowed={route.allowed} permission={route.permission}>
                            {route.element}
                          </RoleGuard>
                        }
                      />
                    ))}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>

                  {/* Global catch-all: redirect unknown URLs to welcome page */}
                  <Route path="*" element={<Navigate to="/" replace />} />
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
