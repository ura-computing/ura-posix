/** Global modal that surfaces when the API client receives a 401 mid-session.
 *
 *  Singleton subscriber pattern (mirrors `setUnauthorizedHandler` in
 *  `api/client.ts`): a module-level setter holds the React `setOpen` from the
 *  mounted instance, and `openSessionExpiredDialog()` flips it. Mount the
 *  component ONCE at app root (`main.tsx`); calling it from multiple places
 *  would race on the setter ref.
 *
 *  UX: the user clicks "Actualiser" → `window.location.reload()` → fresh boot
 *  → no auth cookie → AppLayout's auth guard bounces them to /login. The
 *  "Plus tard" button just dismisses; the next 401 will re-open this dialog,
 *  so the user can't really escape — but we keep the dismiss option so the
 *  modal isn't a hard trap if someone needs to copy a value off the page
 *  before reloading.
 */
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useT } from "@/i18n/I18nProvider";


let _setOpen: ((open: boolean) => void) | null = null;

export function openSessionExpiredDialog(): void {
  _setOpen?.(true);
}


export function SessionExpiredDialog() {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    _setOpen = setOpen;
    return () => {
      _setOpen = null;
    };
  }, []);

  return (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={() => window.location.reload()}
      title={t("session.expiredTitle")}
      description={t("session.expiredDesc")}
      variant="destructive"
      confirmLabel={t("session.refresh")}
      cancelLabel={t("session.later")}
    />
  );
}