/** /auth/signup — « Créer un compte ». Step 1: who you are (3 big choices). Step 2: your
 *  details + your pharmacy (a new one, or the code of an existing one). The admin accepts
 *  every request before the first login; nothing on this page tells whether a pharmacy
 *  code or an email exists. */
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Check, Store, UserRound, type LucideIcon } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { AuthLayout } from "@/pages/auth/_components/AuthLayout";
import { PasswordField } from "@/_components/PasswordField";
import { TextField } from "@/_components/TextField";
import { ROUTES, type SignupIn } from "@/types";
import { cn } from "@/utils/cn";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { useSignup } from "./hooks";

type Kind = "new" | "joinOwner" | "employee";

const KINDS: { kind: Kind; icon: LucideIcon; label: string; hint: string }[] = [
  { kind: "new", icon: Building2, label: "signup.kindNew", hint: "signup.kindNewHint" },
  { kind: "joinOwner", icon: Store, label: "signup.kindJoinOwner", hint: "signup.kindJoinOwnerHint" },
  { kind: "employee", icon: UserRound, label: "signup.kindEmployee", hint: "signup.kindEmployeeHint" },
];

const makeSignupSchema = (t: TFn) =>
  z
    .object({
      kind: z.enum(["new", "joinOwner", "employee"]).nullable(),
      full_name: z.string().trim().min(1, t("signup.required")),
      email: z.string().trim().min(1, t("auth.emailRequired")).email(t("auth.emailInvalid")),
      phone: z.string().trim().min(1, t("signup.required")),
      password: z.string().min(8, t("auth.min8Chars")),
      confirm: z.string().min(1, t("auth.confirmRequired")),
      pharmacy_name: z.string().trim(),
      pharmacy_city: z.string().trim(),
      pharmacy_address: z.string().trim(),
      pharmacy_code: z.string().trim(),
    })
    .superRefine((v, ctx) => {
      const required = (path: string) => ctx.addIssue({ code: "custom", path: [path], message: t("signup.required") });
      if (v.password !== v.confirm) {
        ctx.addIssue({ code: "custom", path: ["confirm"], message: t("auth.passwordMismatch") });
      }
      if (v.kind === "new") {
        if (!v.pharmacy_name) required("pharmacy_name");
        if (!v.pharmacy_city) required("pharmacy_city");
      } else if (!v.pharmacy_code) {
        required("pharmacy_code");
      }
    });

type SignupValues = z.infer<ReturnType<typeof makeSignupSchema>>;

function toSignupIn(v: SignupValues): SignupIn {
  const person = { full_name: v.full_name, email: v.email, phone: v.phone, password: v.password };
  if (v.kind === "new") {
    return {
      ...person,
      role: "owner",
      pharmacy_name: v.pharmacy_name,
      pharmacy_city: v.pharmacy_city,
      pharmacy_address: v.pharmacy_address || undefined,
    };
  }
  return {
    ...person,
    role: v.kind === "employee" ? "employee" : "owner",
    pharmacy_code: v.pharmacy_code.toUpperCase(),
  };
}

function BackToLogin() {
  const t = useT();
  return (
    <Link
      to={ROUTES.LOGIN}
      className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t("auth.backToLogin")}
    </Link>
  );
}

/** One of the 3 « Vous êtes… » choices: a big card, the whole card is the target. */
function KindCard({
  icon: Icon,
  label,
  hint,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        selected ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/60",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

export default function SignupPage() {
  const t = useT();
  const { signup, isSending, isSent } = useSignup();

  const form = useForm<SignupValues>({
    resolver: zodResolver(makeSignupSchema(t)),
    defaultValues: {
      kind: null,
      full_name: "",
      email: "",
      phone: "",
      password: "",
      confirm: "",
      pharmacy_name: "",
      pharmacy_city: "",
      pharmacy_address: "",
      pharmacy_code: "",
    },
  });
  const {
    control,
    register,
    setValue,
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
  } = form;
  const kind = useWatch({ control, name: "kind" });
  const handleSignupSubmit = rhfHandleSubmit((data) => signup(toSignupIn(data)));

  if (isSent) {
    return (
      <AuthLayout>
        <div className="flex w-full flex-col items-center gap-[18px] text-center">
          <span className="flex size-16 items-center justify-center rounded-full border border-success-border bg-success-subtle text-success">
            <Check className="size-[30px]" strokeWidth={2.4} aria-hidden />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{t("signup.sentTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("signup.sentDesc")}</p>
          </div>
          <BackToLogin />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex w-full flex-col gap-6 py-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("signup.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("signup.subtitle")}</p>
        </header>

        <form className="flex flex-col gap-6" onSubmit={handleSignupSubmit} noValidate>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-semibold text-foreground">{t("signup.who")}</legend>
            <div role="radiogroup" aria-label={t("signup.who")} className="flex flex-col gap-2.5">
              {KINDS.map((k) => (
                <KindCard
                  key={k.kind}
                  icon={k.icon}
                  label={t(k.label)}
                  hint={t(k.hint)}
                  selected={kind === k.kind}
                  onSelect={() => setValue("kind", k.kind)}
                />
              ))}
            </div>
          </fieldset>

          {kind && (
            <>
              <fieldset className="flex flex-col gap-4">
                <legend className="mb-4 text-sm font-semibold text-foreground">{t("signup.you")}</legend>
                <TextField
                  label={t("signup.fullName")}
                  autoComplete="name"
                  placeholder={t("signup.fullNamePlaceholder")}
                  error={errors.full_name?.message}
                  {...register("full_name")}
                />
                <TextField
                  label={t("auth.email")}
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  error={errors.email?.message}
                  {...register("email")}
                />
                <TextField
                  label={t("signup.phone")}
                  type="tel"
                  autoComplete="tel"
                  placeholder={t("signup.phonePlaceholder")}
                  error={errors.phone?.message}
                  {...register("phone")}
                />
                <PasswordField
                  label={t("signup.password")}
                  autoComplete="new-password"
                  hint={t("auth.min8Hint")}
                  error={errors.password?.message}
                  {...register("password")}
                />
                <PasswordField
                  label={t("auth.confirmPassword")}
                  autoComplete="new-password"
                  error={errors.confirm?.message}
                  {...register("confirm")}
                />
              </fieldset>

              <fieldset className="flex flex-col gap-4">
                <legend className="mb-4 text-sm font-semibold text-foreground">{t("signup.pharmacy")}</legend>
                {kind === "new" ? (
                  <>
                    <TextField
                      label={t("signup.pharmacyName")}
                      autoComplete="organization"
                      placeholder={t("signup.pharmacyNamePlaceholder")}
                      error={errors.pharmacy_name?.message}
                      {...register("pharmacy_name")}
                    />
                    <TextField
                      label={t("signup.city")}
                      autoComplete="address-level2"
                      placeholder={t("signup.cityPlaceholder")}
                      error={errors.pharmacy_city?.message}
                      {...register("pharmacy_city")}
                    />
                    <TextField
                      label={t("signup.address")}
                      autoComplete="street-address"
                      placeholder={t("signup.addressPlaceholder")}
                      error={errors.pharmacy_address?.message}
                      {...register("pharmacy_address")}
                    />
                  </>
                ) : (
                  <TextField
                    label={t("signup.code")}
                    autoComplete="off"
                    placeholder={t("signup.codePlaceholder")}
                    hint={t(kind === "employee" ? "signup.codeHintEmployee" : "signup.codeHintOwner")}
                    error={errors.pharmacy_code?.message}
                    className="uppercase"
                    {...register("pharmacy_code")}
                  />
                )}
              </fieldset>
            </>
          )}

          <div className="flex flex-col gap-3">
            {/* Always there; usable once « Vous êtes… » is answered. */}
            <AsyncButton
              type="submit"
              variant="primary"
              className="w-full"
              disabled={!kind}
              isLoading={isSending}
              loadingText={t("signup.sending")}
            >
              {t("signup.send")}
            </AsyncButton>
            {!kind && <p className="text-center text-xs text-muted-foreground">{t("signup.chooseFirst")}</p>}
            <p className="text-center text-[13px] text-muted-foreground">
              {t("signup.haveAccount")}{" "}
              <Link to={ROUTES.LOGIN} className="font-semibold text-primary transition-colors hover:text-primary-hover">
                {t("misc.login")}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
