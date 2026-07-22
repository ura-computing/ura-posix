import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { PasswordField } from "@/components/shared/PasswordField";
import { TextField } from "@/components/shared/TextField";
import { ROUTES } from "@/types";
import { cn } from "@/utils/cn";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { useLogin } from "@/pages/login/_hooks/useLogin";

const makeLoginSchema = (t: TFn) =>
  z.object({
    email:    z.string().min(1, t("misc.emailRequired")).email(t("misc.emailInvalid")),
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("misc.loginTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("misc.loginSubtitle")}
          </p>
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
            <AsyncButton
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isPending}
              loadingText={t("misc.loggingIn")}
            >
              {t("misc.login")}
            </AsyncButton>

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
      </div>
    </AuthLayout>
  );
}