/** Create a new owner or employee account (Screen 5).
 *
 *  TWO-STATE dialog:
 *    A. FORM    — full_name + email + password + role (owner/employee) +
 *                 pharmacy picker. The admin / owner TYPES the password
 *                 (end users aren't tech-savvy). The pharmacy picker is
 *                 preselected when `defaultPharmacyId` is set.
 *    B. REVEAL  — after a successful POST, recap the credentials with a
 *                 "Copier" button + an "Ouvrir dans Gmail" compose button
 *                 + a "Fermer" button. The dialog NEVER returns to form state
 *                 in the same lifecycle — closing fully resets via onClose.
 *
 *  `ResetPasswordDialog` (below) uses the same form → reveal flow for password
 *  resets so admin + owner get one consistent credentials flow.
 */
import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, Mail, UserPlus } from "lucide-react";

import { useT, type TFn } from "@/i18n/I18nProvider";
import { Button } from "@/_components/atoms/Button";
import { buttonClass } from "@/_components/atoms/buttonClass";
import { Callout } from "@/_components/molecules/Callout";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { PasswordField } from "@/_components/molecules/PasswordField";
import { SingleSelect } from "@/_components/molecules/SingleSelect";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { ROLE_LABEL } from "@/_components/organisms/memberConstants";
import type { CreateUserIn, CreateUserOut, MemberOut, MemberRole } from "@/types";

export interface PharmacyOption {
  id: number;
  name: string;
  city: string | null;
}

export interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  pharmacies: PharmacyOption[];
  /** Preselect a pharmacy when opened from Screen 2 for a specific one. */
  defaultPharmacyId?: number;
  /** When set, hide the Rôle radio and force every create to this role.
   *  Owner pages pass "employee" — owner can't create co-owners. */
  roleLocked?: MemberRole;
  isSaving?: boolean;
  /** Submit fires the POST mutation; on success the parent passes back the
   *  CreateUserOut so this dialog flips to the reveal state. */
  onSubmit: (values: CreateUserIn) => Promise<CreateUserOut>;
}

const ROLE_DESC: Record<MemberRole, string> = {
  owner: "adminPharm.roleDescOwner",
  employee: "adminPharm.roleDescEmployee",
};

export function CreateUserDialog({
  open,
  onClose,
  pharmacies,
  defaultPharmacyId,
  roleLocked,
  isSaving,
  onSubmit,
}: CreateUserDialogProps) {
  const t = useT();
  const initialRole: MemberRole = roleLocked ?? "employee";
  const initialValues: CreateUserIn = {
    full_name: "",
    email: "",
    password: "",
    role: initialRole,
    pharmacy_id: defaultPharmacyId ?? pharmacies[0]?.id ?? 0,
  };

  const [values, setValues] = useState<CreateUserIn>(initialValues);
  /** Reveal state — non-null after a successful create. */
  const [revealed, setRevealed] = useState<{ member: MemberOut; password: string } | null>(null);

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
    setRevealed({ member: result.member, password: values.password });
  };

  const assignHint = values.role === "owner" ? t("adminPharm.assignHintOwner") : t("adminPharm.assignHintEmployee");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader
          icon={revealed ? <CheckCircle2 className="size-4" /> : <UserPlus className="size-4" />}
          title={revealed ? t("adminPharm.accountCreated") : t("adminPharm.newUser")}
          subtitle={revealed ? t("adminPharm.revealSubtitle") : t("adminPharm.createSubtitle")}
          onClose={onClose}
        />

        {/* ─── State A · Form ──────────────────────────────────────────── */}
        {!revealed && (
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <DialogBody>
              <FormField label={t("adminPharm.fullName")} required>
                <FormInput
                  value={values.full_name ?? ""}
                  onChange={(v) => set("full_name", v)}
                  placeholder="Karim Bennani"
                  required
                />
              </FormField>

              <FormField label={t("adminPharm.email")} required>
                <FormInput
                  type="email"
                  value={values.email}
                  onChange={(v) => set("email", v)}
                  placeholder="karim.bennani@pharmacentre.ma"
                  required
                />
              </FormField>

              <PasswordField
                label={t("adminPharm.password")}
                hint={t("adminPharm.passwordMinHint")}
                value={values.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />

              {/* Rôle radio — hidden when roleLocked is set (owner-side caller
                forces "employee"; admin-side caller shows the choice). */}
              {!roleLocked && (
                <FormField label={t("adminPharm.role")} required group>
                  <div
                    role="radiogroup"
                    aria-label={t("adminPharm.role")}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    {(["owner", "employee"] as const).map((role) => {
                      const selected = values.role === role;
                      return (
                        <ChoiceCard
                          key={role}
                          selected={selected}
                          onSelect={() => set("role", role)}
                          className="flex-row items-start gap-2.5 p-3"
                        >
                          <span
                            data-selected={selected}
                            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-border data-[selected=true]:border-primary"
                          >
                            {selected && <span className="size-2 rounded-full bg-primary" />}
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-semibold text-foreground">{t(ROLE_LABEL[role])}</span>
                            <span className="text-[11.5px] leading-snug text-muted-foreground">
                              {t(ROLE_DESC[role])}
                            </span>
                          </span>
                        </ChoiceCard>
                      );
                    })}
                  </div>
                </FormField>
              )}

              <FormField label={t("adminPharm.assignedPharmacy")} required hint={assignHint} group>
                <SingleSelect
                  label=""
                  options={pharmacies.map((p) => ({
                    value: String(p.id),
                    label: [p.name, p.city].filter(Boolean).join(" · "),
                  }))}
                  value={String(values.pharmacy_id)}
                  onChange={(v) => set("pharmacy_id", Number(v))}
                />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" isLoading={isSaving} loadingText={t("common.saving")}>
                {t("adminPharm.createAccount")}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ─── State B · Reveal ────────────────────────────────────────── */}
        {revealed && (
          <CredentialsReveal
            member={revealed.member}
            tempPassword={revealed.password}
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
  /** Member whose password is being reset; null = closed. */
  member: MemberOut | null;
  onClose: () => void;
  /** Fires the reset mutation with the typed password; on success the
   *  dialog flips to the reveal state. */
  onSubmit: (password: string) => Promise<unknown>;
}

/** Two states like CreateUserDialog: A. new-password form → B. reveal. */
export function ResetPasswordDialog({ member, onClose, onSubmit }: ResetPasswordDialogProps) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Reset on (re)open — same derive-from-prop pattern as CreateUserDialog.
  const [prevMember, setPrevMember] = useState(member);
  if (member !== prevMember) {
    setPrevMember(member);
    setPassword("");
    setSaving(false);
    setDone(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(password);
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader
          icon={done ? <CheckCircle2 className="size-4" /> : <KeyRound className="size-4" />}
          title={done ? t("adminPharm.passwordReset") : t("members.resetPassword")}
          subtitle={t("adminPharm.resetSubtitle")}
          onClose={onClose}
        />
        {member && !done && (
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <DialogBody>
              <PasswordField
                label={t("adminPharm.newPassword")}
                hint={t("adminPharm.passwordMinHint")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                autoFocus
              />
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" isLoading={saving} loadingText={t("common.saving")}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        )}
        {member && done && (
          <CredentialsReveal
            member={member}
            tempPassword={password}
            banner={t("adminPharm.passwordResetFor", { name: member.full_name ?? member.email })}
            kind="reset"
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type MailKind = "create" | "reset";

/** Banner + the password just set (copy) + Gmail / close footer. */
function CredentialsReveal({
  member,
  tempPassword,
  banner,
  kind,
  onClose,
}: {
  member: MemberOut;
  tempPassword: string;
  banner: string;
  kind: MailKind;
  onClose: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copyPassword = async () => {
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <>
      <DialogBody>
        <Callout tone="success" title={banner}>
          {member.email} · {t(ROLE_LABEL[member.role])}
        </Callout>

        <FormField label={t("adminPharm.tempPassword")} hint={t("adminPharm.tempPasswordHint")} group>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-sm text-foreground">
              {tempPassword}
            </code>
            <Button variant="secondary" onClick={copyPassword}>
              {copied ? <CheckCircle2 className="size-4 text-success" /> : <Copy className="size-4" />}
              {copied ? t("adminPharm.copied") : t("adminPharm.copy")}
            </Button>
          </div>
        </FormField>
      </DialogBody>

      <DialogFooter className="justify-between">
        {/* Gmail web compose, not mailto: — mailto goes to the OS default mail
            app (e.g. Thunderbird/Firefox on Ubuntu); client uses Gmail only. */}
        <a
          href={buildGmailUrl(member, tempPassword, kind, t)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass("primary")}
        >
          <Mail className="size-4" />
          {t("adminPharm.sendByGmail")}
        </a>
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </DialogFooter>
    </>
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
    fs: "1",
    to: member.email,
    su: t(kind === "create" ? "adminPharm.mailSubject" : "adminPharm.mailResetSubject"),
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}
