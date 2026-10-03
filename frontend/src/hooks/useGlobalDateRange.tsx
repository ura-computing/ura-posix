/** Cross-route date-range memory.
 *
 *  Every page that has a date-range filter (achats / ventes / alertes /
 *  comptabilité / stock / rapport / admin/stats) reads `from` + `to` from
 *  this Context instead of its own `useState`. Navigating between those
 *  pages preserves the user's date selection. Refresh resets to (null, null).
 *
 *  Provider mounts in `main.tsx` next to `<UploadProvider>`. Anything not
 *  inside the provider tree (the Home page outside `<AppLayout>`) won't have
 *  access, but those pages don't have date filters anyway.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface GlobalDateRange {
  from: string | null;
  to: string | null;
  setRange: (from: string | null, to: string | null) => void;
}

const Ctx = createContext<GlobalDateRange | null>(null);

export function GlobalDateRangeProvider({ children }: { children: ReactNode }) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const setRange = useCallback((f: string | null, t: string | null) => {
    setFrom(f);
    setTo(t);
  }, []);

  return <Ctx.Provider value={{ from, to, setRange }}>{children}</Ctx.Provider>;
}

export function useGlobalDateRange(): GlobalDateRange {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGlobalDateRange must be used inside <GlobalDateRangeProvider>");
  return v;
}
