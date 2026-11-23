/** /auth/signup — « Créer un compte », one short question per screen (like Gmail), « Suivant »
 *  to go on, « Retour » to go back: who you are → your pharmacy (a new one, or its code) →
 *  your name + phone → your email → your password (typed twice). The admin accepts every request before
 *  the first login; nothing on this page tells whether a pharmacy code or an email exists. */
import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Check, Store, UserRound, type LucideIcon } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { AuthLayout } from "@/_components/templates/AuthLayout";
import { PasswordField } from "@/_components/molecules/PasswordField";
import { TextField } from "@/_components/molecules/TextField";
import { WizardProgress } from "@/_components/molecules/WizardProgress";
import { ROUTES, type SignupIn } from "@/types";
import { cn } from "@/utils/cn";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { useSignup } from "./hooks";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";

type Kind = "new" | "joinOwner" | "employee";
type Step = "who" | "pharmacy" | "name" | "email" | "password";
const STEPS: Step[] = ["who", "pharmacy", "name", "email", "password"];

const KINDS: { kind: Kind; icon: LucideIcon; label: string; hint: string }[] = [
  { kind: "new", icon: Building2, label: "signup.kindNew", hint: "signup.kindNewHint" },
  { kind: "joinOwner", icon: Store, label: "signup.kindJoinOwner", hint: "signup.kindJoinOwnerHint" },
  { kind: "employee", icon: UserRound, label: "signup.kindEmployee", hint: "signup.kindEmployeeHint" },
];

interface SignupValues {
  pharmacy_name: string;
  pharmacy_city: string;
  pharmacy_code: string;
  full_name: string;
  phone: string;
  email: string;
  password: string;
  confirm: string;
}

/** The fields one step checks before « Suivant ». */
function stepSchema(t: TFn, step: Step, kind: Kind | null) {
  const required = z.string().trim().min(1, t("signup.required"));
  switch (step) {
    case "pharmacy":
      return kind === "new"
        ? z.object({ pharmacy_name: required, pharmacy_city: required })
        : z.object({ pharmacy_code: required });
    case "name":
      return z.object({ full_name: required, phone: required });
    case "email":
      return z.object({ email: z.string().trim().min(1, t("auth.emailRequired")).email(t("auth.emailInvalid")) });
    case "password":
      return z
        .object({
          password: z.string().min(8, t("auth.min8Chars")),
          confirm: z.string().min(1, t("auth.confirmRequired")),
        })
        .refine((v) => v.password === v.confirm, { path: ["confirm"], message: t("auth.passwordMismatch") });
    default:
      return z.object({});
  }
}

function toSignupIn(kind: Kind, v: SignupValues): SignupIn {
  const person = { full_name: v.full_name.trim(), email: v.email.trim(), phone: v.phone.trim(), password: v.password };
  if (kind === "new") {
    return { ...person, role: "owner", pharmacy_name: v.pharmacy_name.trim(), pharmacy_city: v.pharmacy_city.trim() };
  }
  return {
    ...person,
    role: kind === "employee" ? "employee" : "owner",
    pharmacy_code: v.pharmacy_code.trim().toUpperCase(),
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
    <ChoiceCard selected={selected} onSelect={onSelect} className="flex-row items-start gap-3 p-3.5">
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
    </ChoiceCard>
  );
}

export default function SignupPage() {
  const t = useT();
  const { signup, isSending, isSent } = useSignup();
  const [step, setStep] = useState<Step>("who");
  const [kind, setKind] = useState<Kind | null>(null);

  const form = useForm<SignupValues>({
    defaultValues: {
      pharmacy_name: "",
      pharmacy_city: "",
      pharmacy_code: "",
      full_name: "",
      phone: "",
      email: "",
      password: "",
      confirm: "",
    },
  });
  const {
    register,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = form;

  const index = STEPS.indexOf(step);
  const isLast = index === STEPS.length - 1;

  /** « Suivant » (Enter too): check this step's fields, then the next step or the request. */
  const next = (e: FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    clearErrors();
    const checked = stepSchema(t, step, kind).safeParse(getValues());
    if (!checked.success) {
      for (const issue of checked.error.issues) {
        setError(issue.path[0] as keyof SignupValues, { message: issue.message });
      }
      return;
    }
    if (isLast) signup(toSignupIn(kind, getValues()));
    else setStep(STEPS[index + 1]);
  };

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

  const heading: Record<Step, [string, string]> = {
    who: [t("signup.who"), t("signup.subtitle")],
    pharmacy:
      kind === "new"
        ? [t("signup.pharmacyTitle"), t("signup.pharmacyDesc")]
        : [t("signup.codeTitle"), t(kind === "employee" ? "signup.codeHintEmployee" : "signup.codeHintOwner")],
    name: [t("signup.nameTitle"), t("signup.nameDesc")],
    email: [t("signup.emailTitle"), t("signup.emailDesc")],
    password: [t("signup.passwordTitle"), t("signup.passwordDesc")],
  };
  const [title, desc] = heading[step];

  return (
    <AuthLayout>
      <form className="flex w-full flex-col gap-6" onSubmit={next} noValidate>
        <WizardProgress label={t("signup.title")} total={STEPS.length} current={index} />

        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </header>

        {step === "who" && (
          <div role="radiogroup" aria-label={t("signup.who")} className="flex flex-col gap-2.5">
            {KINDS.map((k) => (
              <KindCard
                key={k.kind}
                icon={k.icon}
                label={t(k.label)}
                hint={t(k.hint)}
                selected={kind === k.kind}
                onSelect={() => setKind(k.kind)}
              />
            ))}
          </div>
        )}

        {step === "pharmacy" &&
          (kind === "new" ? (
            <div className="flex flex-col gap-4">
              <TextField
                label={t("signup.pharmacyName")}
                autoComplete="organization"
                placeholder={t("signup.pharmacyNamePlaceholder")}
                error={errors.pharmacy_name?.message}
                autoFocus
                {...register("pharmacy_name")}
              />
              <TextField
                label={t("signup.city")}
                autoComplete="address-level2"
                placeholder={t("signup.cityPlaceholder")}
                error={errors.pharmacy_city?.message}
                {...register("pharmacy_city")}
              />
            </div>
          ) : (
            <TextField
              label={t("signup.code")}
              autoComplete="off"
              placeholder={t("signup.codePlaceholder")}
              error={errors.pharmacy_code?.message}
              className="uppercase"
              autoFocus
              {...register("pharmacy_code")}
            />
          ))}

        {step === "name" && (
          <div className="flex flex-col gap-4">
            <TextField
              label={t("signup.fullName")}
              autoComplete="name"
              placeholder={t("signup.fullNamePlaceholder")}
              error={errors.full_name?.message}
              autoFocus
              {...register("full_name")}
            />
            <TextField
              label={t("signup.phone")}
              type="tel"
              autoComplete="tel"
              placeholder={t("signup.phonePlaceholder")}
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>
        )}

        {step === "email" && (
          <TextField
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            error={errors.email?.message}
            autoFocus
            {...register("email")}
          />
        )}

        {step === "password" && (
          <div className="flex flex-col gap-4">
            <PasswordField
              label={t("signup.password")}
              autoComplete="new-password"
              hint={t("auth.min8Hint")}
              error={errors.password?.message}
              autoFocus
              {...register("password")}
            />
            <PasswordField
              label={t("auth.confirmPassword")}
              autoComplete="new-password"
              error={errors.confirm?.message}
              {...register("confirm")}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            {index > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep(STEPS[index - 1])}>
                {t("common.back")}
              </Button>
            ) : (
              <span />
            )}
            {/* Always there; on the first screen it waits for a choice. */}
            <Button
              type="submit"
              variant="primary"
              className="min-w-32"
              disabled={!kind}
              isLoading={isSending}
              loadingText={t("signup.sending")}
            >
              {isLast ? t("signup.send") : t("common.next")}
            </Button>
          </div>
          {!kind && <p className="text-right text-xs text-muted-foreground">{t("signup.chooseFirst")}</p>}
        </div>

        <p className="text-center text-[13px] text-muted-foreground">
          {t("signup.haveAccount")}{" "}
          <Link to={ROUTES.LOGIN} className="font-semibold text-primary transition-colors hover:text-primary-hover">
            {t("misc.login")}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
