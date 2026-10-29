import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";

import { Button } from "@/_components/atoms/Button";
import { AuthLayout } from "@/pages/auth/_components/AuthLayout";
import { PasswordField } from "@/_components/PasswordField";
import { TextField } from "@/_components/TextField";
import { ROUTES } from "@/types";
import { cn } from "@/utils/cn";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { useLogin } from "./hooks";

const makeLoginSchema = (t: TFn) =>
  z.object({
    email: z.string().min(1, t("misc.emailRequired")).email(t("misc.emailInvalid")),
    password: z.string().min(1, t("misc.passwordRequired")),
  });

type LoginValues = z.infer<ReturnType<typeof makeLoginSchema>>;

export default function LoginPage() {
  const t = useT();
  const { handleLogin, isPending } = useLogin();

  const loginSchema = makeLoginSchema(t);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const {
    register,
    handleSubmit: HandleLoginSubmit,
    formState: { errors },
  } = form;

  const handleSubmit = HandleLoginSubmit((data) => handleLogin(data));

  return (
    <AuthLayout>
      <div className="flex w-full max-w-[360px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("misc.loginTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("misc.loginSubtitle")}</p>
        </header>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
          <TextField
            label={t("misc.email")}
            type="email"
            autoComplete="email"
            placeholder={t("misc.emailPlaceholder")}
            error={errors.email?.message}
            {...register("email")}
          />

          <PasswordField
            label={t("misc.password")}
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />

          <div className="flex flex-col gap-4">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isPending}
              loadingText={t("misc.loggingIn")}
            >
              {t("misc.login")}
            </Button>

            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className={cn(
                "text-center text-[13px] font-semibold text-primary",
                "transition-colors hover:text-primary-hover",
              )}
            >
              {t("misc.forgotPassword")}
            </Link>
          </div>
        </form>

        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <p className="text-center text-[13px] text-muted-foreground">{t("misc.noAccount")}</p>
          <Link
            to={ROUTES.SIGNUP}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
              "bg-primary text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active",
            )}
          >
            {t("misc.createAccount")}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
