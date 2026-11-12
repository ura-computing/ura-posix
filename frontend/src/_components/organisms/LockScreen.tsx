/** Over the page while this device is locked (`me.lock.locked`), in the login page's layout: « Écran verrouillé »,
 *  the user's name, the 6-digit code (unlocks at the 6th digit, or « Déverrouiller »), « Code oublié ? Se déconnecter »
 *  (log in again with the password, then a new code in « Mon compte »). The page stays under it, untouched. */
import { useState } from "react";

import { Button } from "@/_components/atoms/Button";
import { PinField } from "@/_components/molecules/PinField";
import { AuthLayout } from "@/_components/templates/AuthLayout";
import { useUnlock } from "@/hooks/useLockScreen";
import { useT } from "@/i18n/I18nProvider";

export function LockScreen({ name }: { name: string }) {
  const t = useT();
  const { unlock, isUnlocking, unlockError, clearError, logout } = useUnlock();
  const [pin, setPin] = useState("");
  const send = (code: string) => {
    if (code.length === 6 && !isUnlocking) void unlock(code).catch(() => setPin(""));
  };
  return (
    <div role="dialog" aria-modal="true" aria-label={t("lock.title")} className="fixed inset-0 z-[100] overflow-auto">
      <AuthLayout>
        <div className="flex w-full max-w-[360px] flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("lock.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("lock.text", { name })}</p>
          </header>
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              send(pin);
            }}
            noValidate
          >
            <PinField
              label={t("lock.code")}
              value={pin}
              onChange={(v) => {
                setPin(v);
                if (unlockError) clearError();
              }}
              onComplete={send}
              error={unlockError ?? undefined}
              autoFocus
            />
            <div className="flex flex-col gap-4">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={pin.length !== 6}
                isLoading={isUnlocking}
              >
                {t("lock.unlock")}
              </Button>
              <Button variant="link" className="self-center text-[13px] font-semibold" onClick={logout}>
                {t("lock.forgot")}
              </Button>
            </div>
          </form>
        </div>
      </AuthLayout>
    </div>
  );
}
