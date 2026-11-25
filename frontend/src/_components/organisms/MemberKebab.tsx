/** Row actions for a pharmacy member (owner / employee) — shared by the admin
 *  pharmacy detail page, the owner's "Gérer mon équipe" page and the admin « Support » tab, so all offer
 *  the same menu: reset password / lock-screen code / (dés)activer / supprimer. */
import { KeyRound, Power, RefreshCw, Trash2 } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { KebabItem, KebabMenu } from "@/_components/molecules/KebabMenu";
import type { MemberOut } from "@/types/members";

export function MemberKebab({
  member,
  onResetPassword,
  onResetPin,
  onToggleStatus,
  onRemove,
}: {
  member: Pick<MemberOut, "status">;
  onResetPassword: () => void;
  /** « Réinitialiser le code » (lock screen); absent = not offered. */
  onResetPin?: () => void;
  onToggleStatus: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const toggleLabel = member.status === "active" ? t("members.deactivate") : t("members.reactivate");
  return (
    <KebabMenu>
      {(close) => (
        <>
          <KebabItem icon={<RefreshCw className="size-3.5" />} onSelect={onResetPassword} close={close}>
            {t("members.resetPassword")}
          </KebabItem>
          {onResetPin && (
            <KebabItem icon={<KeyRound className="size-3.5" />} onSelect={onResetPin} close={close}>
              {t("members.resetPin")}
            </KebabItem>
          )}
          <KebabItem icon={<Power className="size-3.5" />} onSelect={onToggleStatus} close={close}>
            {toggleLabel}
          </KebabItem>
          <KebabItem icon={<Trash2 className="size-3.5" />} danger onSelect={onRemove} close={close}>
            {t("members.delete")}
          </KebabItem>
        </>
      )}
    </KebabMenu>
  );
}
