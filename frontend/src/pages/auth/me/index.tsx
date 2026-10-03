import { useState, forwardRef, useId } from "react";

import { TabBar } from "@/_components/TabBar";
import type { TabItem } from "@/_components/TabBar";
import { useMe } from "@/hooks/useMe";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { AsYouType, getCountryCallingCode, type CountryCode, isValidPhoneNumber } from "libphonenumber-js";
import { cn } from "@/utils/cn";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AsyncButton } from "@/_components/AsyncButton";
import { PasswordField } from "@/_components/PasswordField";
import { useChangePassword, useUpdateProfile, useKillSession, useRevokeOtherSessions, useSessions } from "./hooks";
import { Lock, Loader2, Monitor } from "lucide-react";
import { TextField } from "@/_components/TextField";
import type { Me, Session } from "@/types";
import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { useLogout } from "@/hooks/useLogout";

const COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: "MA", label: "Maroc" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Espagne" },
  { code: "US", label: "États-Unis" },
];

interface PhoneFieldProps {
  label: string;
  value: string; // stored as E.164, e.g. "+212600000000"
  onChange: (value: string) => void;
  country?: CountryCode;
  error?: string;
  hint?: string;
}

const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(
  ({ label, value, onChange, country: countryProp, error, hint }, ref) => {
    const t = useT();
    const id = useId();
    const [country, setCountry] = useState<CountryCode>(countryProp ?? "MA");

    const dial = `+${getCountryCallingCode(country)}`;
    const national = value.startsWith(dial) ? value.slice(dial.length) : value.replace(/^\+/, "");
    const display = new AsYouType(country).input(national);

    const emit = (rawNational: string, c: CountryCode) =>
      onChange(`+${getCountryCallingCode(c)}${rawNational.replace(/\D/g, "")}`);

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-md border bg-surface-subtle",
            error ? "border-error" : "border-input",
            "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
          )}
        >
          <select
            aria-label={t("shared.countryCode")}
            value={country}
            onChange={(e) => {
              const c = e.target.value as CountryCode;
              setCountry(c);
              emit(national, c);
            }}
            className="cursor-pointer border-r border-border bg-transparent py-2 pl-3 pr-2 font-mono text-sm text-foreground outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                +{getCountryCallingCode(c.code)}
              </option>
            ))}
          </select>
          <input
            id={id}
            ref={ref}
            type="tel"
            inputMode="tel"
            value={display}
            onChange={(e) => emit(e.target.value, country)}
            className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none"
          />
        </div>
        {error ? (
          <span className="text-xs text-error-subtle-foreground">{error}</span>
        ) : hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    );
  },
);
PhoneField.displayName = "PhoneField";

const makePasswordSchema = (t: (k: string) => string) =>
  z
    .object({
      current_password: z.string().min(1, t("me.currentRequired")),
      new_password: z.string().min(8, t("me.min8chars")),
      confirm_password: z.string().min(1, t("me.confirmRequired")),
    })
    .refine((d) => d.new_password === d.confirm_password, {
      message: t("me.passwordMismatch"),
      path: ["confirm_password"],
    });

type PasswordValues = z.infer<ReturnType<typeof makePasswordSchema>>;

function PasswordTab() {
  const t = useT();
  const form = useForm<PasswordValues>({
    resolver: zodResolver(makePasswordSchema(t)),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = form;

  const { handleChange, isPending } = useChangePassword(() => reset());

  const handlePasswordSubmit = rhfHandleSubmit((data) =>
    handleChange({ current_password: data.current_password, new_password: data.new_password }),
  );

  return (
    <form className="flex max-w-[480px] flex-col gap-5" onSubmit={handlePasswordSubmit} noValidate>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("me.changePassword")}</h2>

      <PasswordField
        label={t("me.currentPassword")}
        autoComplete="current-password"
        error={errors.current_password?.message}
        {...register("current_password")}
      />

      <PasswordField
        label={t("me.newPassword")}
        autoComplete="new-password"
        hint={t("me.min8")}
        error={errors.new_password?.message}
        {...register("new_password")}
      />

      <PasswordField
        label={t("me.confirmPassword")}
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...register("confirm_password")}
      />

      <div className="flex justify-end">
        <AsyncButton type="submit" variant="primary" isLoading={isPending} loadingText={t("me.changing")}>
          {t("me.change")}
        </AsyncButton>
      </div>
    </form>
  );
}

const makeProfileSchema = (t: (k: string) => string) =>
  z.object({
    name: z.string().min(1, t("me.nameRequired")),
    phone: z.string().refine((v) => isValidPhoneNumber(v), t("me.phoneInvalid")),
  });
type ProfileValues = z.infer<ReturnType<typeof makeProfileSchema>>;

function ProfileTab({ me }: { me: Me }) {
  const t = useT();
  const { handleUpdate, isPending } = useUpdateProfile();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(makeProfileSchema(t)),
    defaultValues: { name: me.name, phone: me.phone ?? "" },
  });
  const {
    register,
    control,
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
  } = form;
  const handleProfileSubmit = rhfHandleSubmit((data) => handleUpdate(data));

  return (
    <form className="flex max-w-[480px] flex-col gap-5" onSubmit={handleProfileSubmit} noValidate>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("me.profil")}</h2>

      <TextField
        label={t("me.email")}
        value={me.email}
        disabled
        readOnly
        rightSlot={<Lock className="size-4 text-muted-foreground" aria-hidden />}
        hint={t("me.emailHint")}
      />

      <TextField label={t("me.fullName")} error={errors.name?.message} {...register("name")} />

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <PhoneField
            label={t("me.phone")}
            value={field.value}
            onChange={field.onChange}
            error={errors.phone?.message}
          />
        )}
      />

      <div className="flex justify-end">
        <AsyncButton type="submit" variant="primary" isLoading={isPending} loadingText={t("me.saving")}>
          {t("me.save")}
        </AsyncButton>
      </div>
    </form>
  );
}

// Inline relative time. Avoids pulling date-fns in just for one label.
function frRelative(iso: string, t: TFn): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return t("me.now");
  if (diffSec < 3600) return t("me.minsAgo", { n: Math.floor(diffSec / 60) });
  if (diffSec < 86400) return t("me.hoursAgo", { n: Math.floor(diffSec / 3600) });
  return t("me.daysAgo", { n: Math.floor(diffSec / 86400) });
}

function SessionsTab({ me }: { me: Me }) {
  const t = useT();
  const { sessions, isLoading, isError } = useSessions(me.id);
  const { handleKill, pendingId } = useKillSession();
  const { handleRevokeOthers, isPending: isRevoking } = useRevokeOtherSessions();
  const { handleLogout, isPending: isLoggingOut } = useLogout();
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  const otherCount = sessions.filter((s) => !s.is_current).length;

  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("me.mySessions")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("me.sessionsDesc")}</p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t("me.loading")}
        </div>
      )}

      {isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("me.sessionsError")}
        </p>
      )}

      {!isLoading && !isError && sessions.length === 0 && (
        <p className="rounded-md border border-dashed border-border bg-surface-subtle px-4 py-6 text-sm text-muted-foreground">
          {t("me.noSession")}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            s={s}
            isWorking={pendingId === s.id || (s.is_current && isLoggingOut)}
            onLogoutCurrent={handleLogout}
            onKillOther={handleKill}
          />
        ))}
      </ul>

      {otherCount > 0 && (
        <div className="mt-2 flex justify-end">
          <AsyncButton
            variant="destructive"
            isLoading={isRevoking}
            loadingText={t("me.revokeLoading")}
            onClick={() => setConfirmRevokeOpen(true)}
          >
            {t("me.logoutAll", { n: otherCount })}
          </AsyncButton>
        </div>
      )}

      <ConfirmDialog
        open={confirmRevokeOpen}
        onClose={() => setConfirmRevokeOpen(false)}
        title={t("me.revokeTitle")}
        description={t("me.revokeDesc")}
        confirmLabel={t("me.revokeConfirm")}
        loadingLabel={t("me.revokeLoading")}
        variant="destructive"
        isLoading={isRevoking}
        onConfirm={() => {
          handleRevokeOthers();
          setConfirmRevokeOpen(false);
        }}
      />
    </div>
  );
}

function SessionRow({
  s,
  isWorking,
  onLogoutCurrent,
  onKillOther,
}: {
  s: Session;
  isWorking: boolean;
  onLogoutCurrent: () => void;
  onKillOther: (id: string) => void;
}) {
  const t = useT();
  const lastActive = frRelative(s.last_active_at, t);
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Monitor className="size-5 text-muted-foreground" aria-hidden />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{s.device_label}</span>
            {s.is_current && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {t("me.thisSession")}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {s.ip} · {t("me.lastActivity", { when: lastActive })}
          </span>
        </div>
      </div>
      <AsyncButton
        variant={s.is_current ? "secondary" : "destructive"}
        isLoading={isWorking}
        loadingText="…"
        onClick={() => (s.is_current ? onLogoutCurrent() : onKillOther(s.id))}
      >
        {s.is_current ? t("me.logoutSelf") : t("me.logout")}
      </AsyncButton>
    </li>
  );
}

const buildTabs = (t: TFn): TabItem[] => [
  { id: "profil", label: t("me.tabProfil") },
  { id: "password", label: t("me.tabPassword") },
  { id: "sessions", label: t("me.tabSessions") },
];

export default function MePage() {
  const t = useT();
  const { me } = useMe();
  const [active, setActive] = useState("profil");
  if (!me) return null;

  return (
    <div className="flex max-w-[680px] flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("me.title")}</h1>
      <TabBar tabs={buildTabs(t)} activeId={active} onChange={setActive} />
      <div>
        {active === "profil" && <ProfileTab me={me} />}
        {active === "password" && <PasswordTab />}
        {active === "sessions" && <SessionsTab me={me} />}
      </div>
    </div>
  );
}
