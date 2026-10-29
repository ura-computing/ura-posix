/** Row actions for a pharmacy member (owner / employee) — shared by the admin
 *  pharmacy detail page and the owner's "Gérer mon équipe" page so both offer
 *  the same menu: reset password / (dés)activer / supprimer. */
import { Power, RefreshCw, Trash2 } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { KebabItem, KebabMenu } from "@/_components/molecules/KebabMenu";
import type { MemberOut } from "@/types";

export function MemberKebab({
  member,
  onResetPassword,
  onToggleStatus,
  onRemove,
}: {
  member: MemberOut;
  onResetPassword: () => void;
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
