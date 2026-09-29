/** Row actions for a pharmacy member (owner / employee) — shared by the admin
 *  pharmacy detail page and the owner's "Gérer mon équipe" page so both offer
 *  the same menu: reset password / (dés)activer / supprimer. */
import { Power, RefreshCw, Trash2 } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { KebabMenu } from "@/components/shared/KebabMenu";
import type { MemberOut } from "@/types";


const ITEM = "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm";


export function MemberKebab({
  member, onResetPassword, onToggleStatus, onRemove,
}: {
  member:          MemberOut;
  onResetPassword: () => void;
  onToggleStatus:  () => void;
  onRemove:        () => void;
}) {
  const t = useT();
  const toggleLabel = member.status === "active" ? t("members.deactivate") : t("members.reactivate");
  return (
    <KebabMenu>
      {(close) => (
        <>
          <button type="button" onClick={() => { onResetPassword(); close(); }} className={`${ITEM} hover:bg-surface-subtle`}>
            <RefreshCw className="size-3.5" />
            {t("members.resetPassword")}
          </button>
          <button type="button" onClick={() => { onToggleStatus(); close(); }} className={`${ITEM} hover:bg-surface-subtle`}>
            <Power className="size-3.5" />
            {toggleLabel}
          </button>
          <button type="button" onClick={() => { onRemove(); close(); }} className={`${ITEM} text-destructive hover:bg-destructive/5`}>
            <Trash2 className="size-3.5" />
            {t("members.delete")}
          </button>
        </>
      )}
    </KebabMenu>
  );
}
