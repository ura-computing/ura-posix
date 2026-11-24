/** The app's routes, made from `ROLE_ROUTES` (routes.ts): public pages, guest pages (not logged in), pages of every
 *  logged-in account, then each role's pages behind its role guard (and the page's permission when it has one). */
import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import { RequireFeature } from "@/_components/routing/RequireFeature";
import { RequireGuest } from "@/_components/routing/RequireGuest";
import { RequireRole } from "@/_components/routing/RequireRole";
import { AppLayout } from "@/_components/templates/AppLayout";
import NotFoundPage from "@/pages/common/not-found";
import { ROLE_ROUTES, type AppRoute } from "@/routes";
import { ROLES } from "@/types";

/** Each page's lazy component, made once (its file downloads on first visit). */
const withPage = (routes: AppRoute[]) => routes.map((r) => ({ ...r, Page: lazy(r.load) }));
const PUBLIC = withPage(ROLE_ROUTES.public);
const GUEST = withPage(ROLE_ROUTES.guest);
const SIGNED_IN = withPage(ROLE_ROUTES.signedIn);
const BY_ROLE = [
  { role: ROLES.ADMIN, pages: withPage(ROLE_ROUTES.admin) },
  { role: ROLES.SUPPORT, pages: withPage(ROLE_ROUTES.support) },
  { role: ROLES.OWNER, pages: withPage(ROLE_ROUTES.owner) },
  { role: ROLES.EMPLOYEE, pages: withPage(ROLE_ROUTES.employee) },
];

export default function App() {
  // 2 s after the first screen: fetch every page's file, so later clicks don't wait.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const routes of Object.values(ROLE_ROUTES)) for (const r of routes) void r.load();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={null}>
      <Routes>
        {PUBLIC.map(({ path, Page }) => (
          <Route key={path} path={path} element={<Page />} />
        ))}

        <Route element={<RequireGuest />}>
          {GUEST.map(({ path, Page }) => (
            <Route key={path} path={path} element={<Page />} />
          ))}
        </Route>

        {/* Logged in: the layout; another role's address = the 404 inside it. */}
        <Route element={<AppLayout />}>
          {SIGNED_IN.map(({ path, Page }) => (
            <Route key={path} path={path} element={<Page />} />
          ))}
          {BY_ROLE.map(({ role, pages }) => (
            <Route key={role} element={<RequireRole role={role} />}>
              {pages.map(({ path, feature, Page }) =>
                feature ? (
                  <Route key={path} element={<RequireFeature feature={feature} />}>
                    <Route path={path} element={<Page />} />
                  </Route>
                ) : (
                  <Route key={path} path={path} element={<Page />} />
                ),
              )}
            </Route>
          ))}
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
