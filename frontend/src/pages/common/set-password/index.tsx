import { ROUTES } from "@/routes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { AuthLayout } from "@/_components/templates/AuthLayout";
import { PasswordField } from "@/_components/molecules/PasswordField";

import { useT, type TFn } from "@/i18n/I18nProvider";

import { useSetPassword, useValidateToken } from "./hooks";

const makeSetPasswordSchema = (t: TFn) =>
  z
    .object({
      password: z.string().min(8, t("auth.min8Chars")),
      confirmPassword: z.string().min(1, t("auth.confirmRequired")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.passwordMismatch"),
      path: ["confirmPassword"],
    });

type SetPasswordValues = z.infer<ReturnType<typeof makeSetPasswordSchema>>;

function FormSkeleton() {
  return (
    <div className="flex w-full max-w-[360px] flex-col gap-6" aria-busy>
      <div className="flex flex-col gap-2">
        <div className="h-7 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-[68px] animate-pulse rounded-md bg-muted" />
      <div className="h-[68px] animate-pulse rounded-md bg-muted" />
      <div className="h-[46px] animate-pulse rounded-md bg-muted" />
    </div>
  );
}

function ExpiredState() {
  const t = useT();
  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-[18px] text-center">
      <span className="flex size-16 items-center justify-center rounded-full border border-warning-border bg-warning-subtle text-warning">
        <TriangleAlert className="size-[30px]" strokeWidth={2.2} aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{t("auth.expiredTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("auth.expiredDesc")}</p>
      </div>
      <Link
        to={ROUTES.FORGOT_PASSWORD}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {t("auth.requestNewLink")}
      </Link>
    </div>
  );
}

export default function SetPasswordPage() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { isValidating, isValid, isSetup, fullName } = useValidateToken(token);
  const { handleSetPassword, isPending } = useSetPassword(token);

  const setPasswordSchema = makeSetPasswordSchema(t);
  const form = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
  } = form;
  const handleSetPasswordSubmit = rhfHandleSubmit((data) => handleSetPassword({ password: data.password }));

  if (isValidating)
    return (
      <AuthLayout>
        <FormSkeleton />
      </AuthLayout>
    );
  if (!isValid)
    return (
      <AuthLayout>
        <ExpiredState />
      </AuthLayout>
    );

  return (
    <AuthLayout>
      <div className="flex w-full max-w-[360px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSetup ? t("auth.welcome", { name: fullName ?? "" }) : t("auth.resetTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{isSetup ? t("auth.setupDesc") : t("auth.resetDesc")}</p>
        </header>

        <form className="flex flex-col gap-6" onSubmit={handleSetPasswordSubmit} noValidate>
          <PasswordField
            label={t("auth.newPassword")}
            autoComplete="new-password"
            hint={t("auth.min8Hint")}
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordField
            label={isSetup ? t("auth.confirmPassword") : t("auth.confirmNewPassword")}
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isPending}
            loadingText={isSetup ? t("auth.activating") : t("auth.resetting")}
          >
            {isSetup ? t("auth.activateAccount") : t("auth.resetButton")}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
