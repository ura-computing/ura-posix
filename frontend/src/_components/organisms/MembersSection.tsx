/** Members card of a pharmacy: header (title + add button), then the members table
 *  (owners first) or an empty message. One component for the admin pharmacy page and
 *  the owner's « Gérer mon équipe » (product rule: both pages behave the same).
 *  The dialogs (permissions, password, delete, create) stay with each page. */
import { SlidersHorizontal, UserPlus, Users } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import type { MemberOut } from "@/types/members";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { FeaturePills } from "@/_components/molecules/FeaturePills";
import { MemberKebab } from "@/_components/organisms/MemberKebab";
import { ROLE_LABEL, STATUS_LABEL } from "@/_components/organisms/memberConstants";

export interface MembersSectionProps {
  title: string;
  description: string;
  addLabel: string;
  onAdd: () => void;
  emptyText: string;
  members: MemberOut[];
  onManagePermissions: (member: MemberOut) => void;
  onResetPassword: (member: MemberOut) => void;
  onResetPin: (member: MemberOut) => void;
  onToggleStatus: (member: MemberOut) => void;
  onRemove: (member: MemberOut) => void;
}

const initials = (m: MemberOut) =>
  (m.full_name ?? m.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

export function MembersSection({
  title,
  description,
  addLabel,
  onAdd,
  emptyText,
  members,
  onManagePermissions,
  onResetPassword,
  onResetPin,
  onToggleStatus,
  onRemove,
}: MembersSectionProps) {
  const t = useT();
  const rows = [...members.filter((m) => m.role === "owner"), ...members.filter((m) => m.role !== "owner")];

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="primary" onClick={onAdd}>
          <UserPlus className="size-4" />
          {addLabel}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Users className="size-5" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5">{t("adminPharm.colName")}</th>
              <th className="px-3 py-2.5">{t("adminPharm.colRole")}</th>
              <th className="px-3 py-2.5">{t("col.statut")}</th>
              <th className="px-3 py-2.5">{t("adminPharm.colPerms")}</th>
              <th className="px-3 py-2.5 text-right">{t("adminPharm.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                      {initials(m)}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-foreground">{m.full_name ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={m.role === "owner" ? "primary" : "neutral"}>{t(ROLE_LABEL[m.role])}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={m.status === "active" ? "success" : "neutral"}>{t(STATUS_LABEL[m.status])}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <FeaturePills features={m.granted_permissions} maxShown={3} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onManagePermissions(m)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-surface-subtle"
                    >
                      <SlidersHorizontal className="size-3.5" />
                      {t("adminPharm.managePerms")}
                    </button>
                    <MemberKebab
                      member={m}
                      onResetPassword={() => onResetPassword(m)}
                      onResetPin={() => onResetPin(m)}
                      onToggleStatus={() => onToggleStatus(m)}
                      onRemove={() => onRemove(m)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
