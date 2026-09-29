/** Create a new owner or employee account (Screen 5).
 *
 *  TWO-STATE dialog:
 *    A. FORM    — full_name + email + role (owner/employee) + pharmacy picker.
 *                 The pharmacy picker is preselected when `defaultPharmacyId`
 *                 is set (caller is on Screen 2 for that pharmacy), but still
 *                 shown so the admin can override.
 *    B. REVEAL  — after a successful POST, show the one-time temp_password
 *                 with a "Copier" button + an "Ouvrir dans Gmail" compose button
 *                 + a "Fermer" button. The dialog NEVER returns to form state
 *                 in the same lifecycle — closing fully resets via onClose.
 *
 *  The reveal IS the only chance to see the cleartext password (backend
 *  doesn't persist it). The Gmail link opens a compose tab with the email
 *  pre-filled in `to:` and the credentials in the body.
 *
 *  `ResetPasswordDialog` (below) reuses the same reveal for password resets
 *  so admin + owner get one consistent credentials flow.
 */
import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, Mail, UserPlus, X } from "lucide-react";

import { useT, type TFn } from "@/i18n/I18nProvider";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { SingleSelectPopover } from "@/components/shared/SingleSelectPopover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ROLE_LABEL } from "./constants";
import type { CreateUserIn, CreateUserOut, MemberOut, MemberRole } from "@/types";


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

  // Reset everything when the dialog (re)opens — uses the recommended
  // "derive state from a prop change" pattern instead of useEffect, so we
  // avoid cascading re-renders. See react.dev/learn/you-might-not-need-an-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(initialValues);
      setRevealed(null);
    }
  }

  const set = <K extends keyof CreateUserIn>(key: K, v: CreateUserIn[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await onSubmit(values);
    setRevealed(result);
  };

  const assignHint =
    values.role === "owner"
      ? t("adminPharm.assignHintOwner")
      : t("adminPharm.assignHintEmployee");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHead
          icon={revealed ? <CheckCircle2 className="size-4" /> : <UserPlus className="size-4" />}
          title={revealed ? t("adminPharm.accountCreated") : t("adminPharm.newUser")}
          subtitle={revealed ? t("adminPharm.revealSubtitle") : t("adminPharm.createSubtitle")}
          onClose={onClose}
        />

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
          <CredentialsReveal
            member={revealed.member}
            tempPassword={revealed.temp_password}
            banner={t("adminPharm.accountCreatedFor", { name: revealed.member.full_name ?? revealed.member.email })}
            kind="create"
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}


export interface ResetPasswordDialogProps {
  /** Member + fresh temp password from the reset mutation; null = closed. */
  reset:   { member: MemberOut; tempPassword: string } | null;
  onClose: () => void;
}


/** Same reveal as CreateUserDialog's state B, for password resets. */
export function ResetPasswordDialog({ reset, onClose }: ResetPasswordDialogProps) {
  const t = useT();
  return (
    <Dialog open={reset !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHead
          icon={<KeyRound className="size-4" />}
          title={t("adminPharm.passwordReset")}
          subtitle={t("adminPharm.resetSubtitle")}
          onClose={onClose}
        />
        {reset && (
          <CredentialsReveal
            member={reset.member}
            tempPassword={reset.tempPassword}
            banner={t("adminPharm.passwordResetFor", { name: reset.member.full_name ?? reset.member.email })}
            kind="reset"
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}


function DialogHead({ icon, title, subtitle, onClose }: { icon: React.ReactNode; title: string; subtitle: string; onClose: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary/15 text-primary">
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label={t("common.close")} className="cursor-pointer text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  );
}


type MailKind = "create" | "reset";

/** Banner + one-time temp password (copy) + Gmail / close footer. */
function CredentialsReveal({
  member, tempPassword, banner, kind, onClose,
}: {
  member:       MemberOut;
  tempPassword: string;
  banner:       string;
  kind:         MailKind;
  onClose:      () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1 rounded-lg border border-success-border bg-success-subtle px-4 py-3 text-success-subtle-foreground">
        <span className="text-sm font-semibold">{banner}</span>
        <span className="text-xs">
          {member.email} · {t(ROLE_LABEL[member.role])}
        </span>
      </div>

      <Field label={t("adminPharm.tempPassword")} hint={t("adminPharm.tempPasswordHint")}>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-sm text-foreground">
            {tempPassword}
          </code>
          <AsyncButton variant="secondary" onClick={copyPassword}>
            {copied ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
            {copied ? t("adminPharm.copied") : t("adminPharm.copy")}
          </AsyncButton>
        </div>
      </Field>

      <div className="-mx-5 -mb-5 mt-1 flex items-center justify-between gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
        {/* Gmail web compose, not mailto: — mailto goes to the OS default mail
            app (e.g. Thunderbird/Firefox on Ubuntu); client uses Gmail only. */}
        <a
          href={buildGmailUrl(member, tempPassword, kind, t)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Mail className="size-4" />
          {t("adminPharm.sendByGmail")}
        </a>
        <AsyncButton variant="secondary" onClick={onClose}>
          {t("common.close")}
        </AsyncButton>
      </div>
    </div>
  );
}


/** Gmail web compose URL with the credentials prefilled. The admin reviews +
 *  sends from Gmail in a new tab of the current browser. */
function buildGmailUrl(member: MemberOut, tempPassword: string, kind: MailKind, t: TFn): string {
  const body = [
    t("adminPharm.mailGreeting", { name: member.full_name ?? "" }),
    "",
    t(kind === "create" ? "adminPharm.mailBody1" : "adminPharm.mailResetBody1"),
    "",
    t("adminPharm.mailEmail", { email: member.email }),
    t("adminPharm.mailPassword", { pwd: tempPassword }),
    "",
    t("adminPharm.mailBody2"),
  ].join("\n");
  const params = new URLSearchParams({
    view: "cm",
    fs:   "1",
    to:   member.email,
    su:   t(kind === "create" ? "adminPharm.mailSubject" : "adminPharm.mailResetSubject"),
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
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
