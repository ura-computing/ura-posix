import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router";
import { useEffect, type ReactNode } from "react";
import "./App.css";
import { Toaster } from "./components/shared/toaster";

import { Layout } from "./components/layout/layout";
import { Login } from "./pages/login";
import { routes } from "./routes";
import { useStatusPoller } from "./hooks/useStatusPoller";
import { useMe } from "./hooks/useMe";
import { useAuthenticate } from "./hooks/useAuthenticate";
import { hasSession } from "./utils/session";
import { eUserStatus, type UserRole } from "./types";

// Redirects to /login if no session token exists (synchronous — no flicker).
function ProtectedRoute({ fallback, children }: { fallback?: ReactNode; children?: ReactNode }) {
  if (!hasSession()) {
    return fallback ?? <Navigate to="/login" replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}

// Redirects authenticated users away from guest-only pages (login, register).
function GuestRoute() {
  if (hasSession()) {
    return <Navigate to="/rapports" replace />;
  }
  return <Outlet />;
}

// Blocks navigation to any route other than "/" for pending accounts.
// Also polls the backend while pending so approval is reflected immediately.
function PendingGuard() {
  const { me: identity } = useMe();
  const location = useLocation();
  const navigate = useNavigate();

  useStatusPoller(identity);
  useExtensionLogoutSync();

  useEffect(() => {
    if (identity && identity.status !== eUserStatus.ACTIVE && location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [identity, location.pathname, navigate]);

  return <Outlet />;
}

// Listens for APCM_FORCE_LOGOUT (extension popup logout) and auth:unauthorized (401 from API).
function useExtensionLogoutSync() {
  const { logout } = useAuthenticate();
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "APCM_FORCE_LOGOUT") logout();
    };
    const handleUnauthorized = () => logout();
    window.addEventListener("message", handleMessage);
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [logout]);
}

function RoleGuard({ allowed, permission, children }: { allowed?: UserRole[]; permission?: string; children: ReactNode }) {
  const { me: identity, meLoading: isLoading } = useMe();
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
          <Routes>
            {/* Universal routes (accessible to all, no auth wrapper) */}
            {universalRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}

            {/* Public routes (redirect to /rapports if already logged in) */}
            <Route element={<GuestRoute />}>
              {publicRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Route>

            {/* Auth routes without sidebar layout */}
            <Route element={<ProtectedRoute fallback={<Login />} />}>
              {authRoutesNoLayout.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Route>

            {/* Auth routes with sidebar layout */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout>
                    <PendingGuard />
                  </Layout>
                </ProtectedRoute>
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

            {/* Global catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
