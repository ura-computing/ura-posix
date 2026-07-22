/** Create a new owner or employee account (Screen 5).
 *
 *  TWO-STATE dialog:
 *    A. FORM    — full_name + email + role (owner/employee) + pharmacy picker.
 *                 The pharmacy picker is preselected when `defaultPharmacyId`
 *                 is set (caller is on Screen 2 for that pharmacy), but still
 *                 shown so the admin can override.
 *    B. REVEAL  — after a successful POST, show the one-time temp_password
 *                 with a "Copier" button + a "Envoyer par email" mailto button
 *                 + a "Fermer" button. The dialog NEVER returns to form state
 *                 in the same lifecycle — closing fully resets via onClose.
 *
 *  The reveal IS the only chance to see the cleartext password (backend
 *  doesn't persist it). The mailto: link opens the admin's default mail
 *  client with the email pre-filled in `to:` and the credentials in the body.
 */
import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Mail, UserPlus, X } from "lucide-react";

import { useT, type TFn } from "@/i18n/I18nProvider";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { SingleSelectPopover } from "@/components/shared/SingleSelectPopover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ROLE_LABEL } from "./constants";
import type { CreateUserIn, CreateUserOut, MemberRole } from "@/types";


export interface PharmacyOption {
  id:    number;
  name:  string;
  city:  string | null;
}


export interface CreateUserDialogProps {
  open:              boolean;
  onClose:           () => void;
  pharmacies:        PharmacyOption[];
  /** Preselect a pharmacy when opened from Screen 2 for a specific one. */
  defaultPharmacyId?: number;
  /** When set, hide the Rôle radio and force every create to this role.
   *  Owner pages pass "employee" — owner can't create co-owners. */
  roleLocked?:       MemberRole;
  isSaving?:         boolean;
  /** Submit fires the POST mutation; on success the parent passes back the
   *  CreateUserOut so this dialog flips to the reveal state. */
  onSubmit:          (values: CreateUserIn) => Promise<CreateUserOut>;
}


const ROLE_DESC: Record<MemberRole, string> = {
  owner:    "adminPharm.roleDescOwner",
  employee: "adminPharm.roleDescEmployee",
};


export function CreateUserDialog({
  open, onClose, pharmacies, defaultPharmacyId, roleLocked, isSaving, onSubmit,
}: CreateUserDialogProps) {
  const t = useT();
  const initialRole: MemberRole = roleLocked ?? "employee";
  const initialValues: CreateUserIn = {
    full_name:   "",
    email:       "",
    role:        initialRole,
    pharmacy_id: defaultPharmacyId ?? pharmacies[0]?.id ?? 0,
  };

  const [values, setValues] = useState<CreateUserIn>(initialValues);
  /** Reveal state — non-null after a successful create. */
  const [revealed, setRevealed] = useState<CreateUserOut | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset everything when the dialog (re)opens — uses the recommended
  // "derive state from a prop change" pattern instead of useEffect, so we
  // avoid cascading re-renders. See react.dev/learn/you-might-not-need-an-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(initialValues);
      setRevealed(null);
      setCopied(false);
    }
  }

  const set = <K extends keyof CreateUserIn>(key: K, v: CreateUserIn[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await onSubmit(values);
    setRevealed(result);
  };

  const copyPassword = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.temp_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  const mailtoHref = revealed ? buildMailto(revealed, t) : "#";

  const assignHint =
    values.role === "owner"
      ? t("adminPharm.assignHintOwner")
      : t("adminPharm.assignHintEmployee");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
              {revealed ? <CheckCircle2 className="size-4" /> : <UserPlus className="size-4" />}
            </span>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[17px] font-semibold text-foreground">
                {revealed ? t("adminPharm.accountCreated") : t("adminPharm.newUser")}
              </h3>
              <span className="text-xs text-muted-foreground">
                {revealed ? t("adminPharm.revealSubtitle") : t("adminPharm.createSubtitle")}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* ─── State A · Form ──────────────────────────────────────────── */}
        {!revealed && (
          <form className="flex flex-col gap-4 p-5" onSubmit={handleSubmit}>
            <Field label={t("adminPharm.fullName")} required>
              <Input value={values.full_name ?? ""} onChange={(v) => set("full_name", v)} placeholder="Karim Bennani" required />
            </Field>

            <Field label={t("adminPharm.email")} required>
              <Input type="email" value={values.email} onChange={(v) => set("email", v)} placeholder="karim.bennani@pharmacentre.ma" required />
            </Field>

            {/* Rôle radio — hidden when roleLocked is set (owner-side caller
                forces "employee"; admin-side caller shows the choice). */}
            {!roleLocked && (
              <Field label={t("adminPharm.role")} required>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["owner", "employee"] as const).map((role) => {
                    const selected = values.role === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        data-selected={selected}
                        onClick={() => set("role", role)}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-left transition-colors data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
                      >
                        <span
                          data-selected={selected}
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-border data-[selected=true]:border-primary"
                        >
                          {selected && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-semibold text-foreground">{t(ROLE_LABEL[role])}</span>
                          <span className="text-[11.5px] leading-snug text-muted-foreground">{t(ROLE_DESC[role])}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            <Field label={t("adminPharm.assignedPharmacy")} required hint={assignHint}>
              <SingleSelectPopover
                label=""
                options={pharmacies.map((p) => ({
                  value: String(p.id),
                  label: [p.name, p.city].filter(Boolean).join(" · "),
                }))}
                value={String(values.pharmacy_id)}
                onChange={(v) => set("pharmacy_id", Number(v))}
              />
            </Field>

            <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
              <AsyncButton type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                {t("common.cancel")}
              </AsyncButton>
              <AsyncButton type="submit" variant="primary" disabled={isSaving}>
                {isSaving && <Loader2 className="size-3.5 animate-spin" />}
                {t("adminPharm.createAccount")}
              </AsyncButton>
            </div>
          </form>
        )}

        {/* ─── State B · Reveal ────────────────────────────────────────── */}
        {revealed && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1 rounded-lg border border-success-border bg-success-subtle px-4 py-3 text-success-subtle-foreground">
              <span className="text-sm font-semibold">{t("adminPharm.accountCreatedFor", { name: revealed.member.full_name ?? revealed.member.email })}</span>
              <span className="text-xs">
                {revealed.member.email} · {t(ROLE_LABEL[revealed.member.role])}
              </span>
            </div>

            <Field label={t("adminPharm.tempPassword")} hint={t("adminPharm.tempPasswordHint")}>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-sm text-foreground">
                  {revealed.temp_password}
                </code>
                <AsyncButton variant="secondary" onClick={copyPassword}>
                  {copied ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
                  {copied ? t("adminPharm.copied") : t("adminPharm.copy")}
                </AsyncButton>
              </div>
            </Field>

            <div className="-mx-5 -mb-5 mt-1 flex items-center justify-between gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
              <a
                href={mailtoHref}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <Mail className="size-4" />
                {t("adminPharm.sendByEmail")}
              </a>
              <AsyncButton variant="secondary" onClick={onClose}>
                {t("common.close")}
              </AsyncButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


/** Build a mailto: link with the credentials prefilled in the body. The admin
 *  reviews + sends from their own mail client. */
function buildMailto(out: CreateUserOut, t: TFn): string {
  const subject = encodeURIComponent(t("adminPharm.mailSubject"));
  const body = encodeURIComponent(
    [
      t("adminPharm.mailGreeting", { name: out.member.full_name ?? "" }),
      "",
      t("adminPharm.mailBody1"),
      "",
      t("adminPharm.mailEmail", { email: out.member.email }),
      t("adminPharm.mailPassword", { pwd: out.temp_password }),
      "",
      t("adminPharm.mailBody2"),
    ].join("\n"),
  );
  return `mailto:${out.member.email}?subject=${subject}&body=${body}`;
}


// ─── Tiny inline form primitives (kept inline to avoid one-off shared/ files) ──

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11.5px] leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Input({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-surface-subtle px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    />
  );
}
