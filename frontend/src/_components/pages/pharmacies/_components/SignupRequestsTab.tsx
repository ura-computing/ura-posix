/** « Demandes » tab of /admin/pharmacies: every pending « Créer un compte ». « Accepter »
 *  creates the account (and the new pharmacy when there is one), « Refuser » creates
 *  nothing; both send the person an email. « Accepter » stays visible but greyed out, with
 *  the reason, when the email already has an account or no pharmacy has the code. */
import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/_components/atoms/Button";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { useT } from "@/i18n/I18nProvider";
import type { SignupRequestRow } from "@/types/members";
import { formatDateTime } from "@/utils/format";

import { useAcceptSignup, useRefuseSignup, useSignupRequests } from "../hooks";
import { Badge } from "@/_components/atoms/Badge";

export function SignupRequestsTab() {
  const t = useT();
  const { requests, isLoading } = useSignupRequests();
  const { acceptSignup, isAccepting } = useAcceptSignup();
  const { refuseSignup, isRefusing } = useRefuseSignup();
  const [toAccept, setToAccept] = useState<SignupRequestRow | null>(null);
  const [toRefuse, setToRefuse] = useState<SignupRequestRow | null>(null);

  /** What « Accepter » would refuse, in words (empty = it can be accepted). */
  const blockers = (r: SignupRequestRow) =>
    [r.email_taken && t("signupReq.emailTaken"), r.code_unknown && t("signupReq.codeUnknown")].filter(
      (b): b is string => Boolean(b),
    );

  const columns: ColumnDef<SignupRequestRow>[] = [
    {
      key: "date",
      label: t("signupReq.colDate"),
      sortable: false,
      render: (r) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatDateTime(r.created_at)}</span>
      ),
    },
    {
      key: "person",
      label: t("signupReq.colPerson"),
      sortable: false,
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground">{r.full_name}</span>
          <span className="text-xs text-muted-foreground">{r.email}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{r.phone}</span>
        </div>
      ),
    },
    {
      key: "request",
      label: t("signupReq.colRequest"),
      sortable: false,
      render: (r) => (
        <div className="flex flex-col gap-1">
          <Badge className="w-fit">{t(`roles.${r.role}`)}</Badge>
          {r.pharmacy_code ? (
            <span className="text-sm text-foreground">
              {t("signupReq.join", { code: r.pharmacy_code })}
              {r.pharmacy && <span className="text-muted-foreground"> · {r.pharmacy.name}</span>}
            </span>
          ) : (
            <span className="flex flex-col text-sm text-foreground">
              {t("signupReq.newPharmacy", { name: r.new_pharmacy_name ?? "—" })}
              <span className="text-xs text-muted-foreground">
                {[r.new_pharmacy_city, r.new_pharmacy_address].filter(Boolean).join(" · ")}
              </span>
            </span>
          )}
        </div>
      ),
    },
    {
      key: "check",
      label: t("signupReq.colCheck"),
      sortable: false,
      render: (r) => {
        const reasons = blockers(r);
        return reasons.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("signupReq.allGood")}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {reasons.map((reason) => (
              <Badge key={reason} tone="warning">
                {reason}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "",
      sortable: false,
      render: (r) => {
        const reasons = blockers(r);
        return (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Button size="sm" disabled={reasons.length > 0} onClick={() => setToAccept(r)}>
                <Check className="size-3.5" />
                {t("signupReq.accept")}
              </Button>
              <Button variant="danger-outline" size="sm" onClick={() => setToRefuse(r)}>
                <X className="size-3.5" />
                {t("signupReq.refuse")}
              </Button>
            </div>
            {reasons.length > 0 && (
              <span className="max-w-[260px] text-right text-[11px] text-muted-foreground">
                {t("signupReq.cannotAccept", { reason: reasons.join(", ").toLowerCase() })}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const acceptCopy = toAccept
    ? toAccept.pharmacy
      ? t("signupReq.confirmAcceptJoin", {
          name: toAccept.full_name,
          pharmacy: `${toAccept.pharmacy.code} · ${toAccept.pharmacy.name}`,
        })
      : t("signupReq.confirmAcceptNew", {
          name: toAccept.full_name,
          pharmacy: toAccept.new_pharmacy_name ?? "—",
          city: toAccept.new_pharmacy_city ?? "—",
        })
    : "";

  return (
    <>
      <DataTable
        rows={requests}
        columns={columns}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle={t("signupReq.empty")}
      />

      <ConfirmDialog
        open={toAccept !== null}
        onClose={() => setToAccept(null)}
        onConfirm={() => {
          if (!toAccept) return;
          void acceptSignup(toAccept.id).then((res) => {
            toast.success(t("signupReq.toastAccepted", { code: res.pharmacy_code }));
            setToAccept(null);
          });
        }}
        title={t("signupReq.confirmAcceptTitle", { name: toAccept?.full_name ?? "" })}
        description={acceptCopy}
        confirmLabel={t("signupReq.accept")}
        loadingLabel={t("signupReq.accepting")}
        isLoading={isAccepting}
      />

      <ConfirmDialog
        open={toRefuse !== null}
        onClose={() => setToRefuse(null)}
        onConfirm={() => {
          if (!toRefuse) return;
          void refuseSignup(toRefuse.id).then(() => {
            toast.success(t("signupReq.toastRefused"));
            setToRefuse(null);
          });
        }}
        title={t("signupReq.confirmRefuseTitle", { name: toRefuse?.full_name ?? "" })}
        description={t("signupReq.confirmRefuseDesc")}
        variant="destructive"
        confirmLabel={t("signupReq.refuse")}
        loadingLabel={t("signupReq.refusing")}
        isLoading={isRefusing}
      />
    </>
  );
}
