import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { AuthLayout } from "@/pages/auth/_components/AuthLayout";
import { TextField } from "@/_components/TextField";
import { ROUTES } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { useForgotPassword } from "./hooks";

const makeForgotSchema = (t: TFn) =>
  z.object({
    email: z.string().min(1, t("auth.emailRequired")).email(t("auth.emailInvalid")),
  });

type ForgotValues = z.infer<ReturnType<typeof makeForgotSchema>>;

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

export default function ForgotPasswordPage() {
  const t = useT();
  const { handleForgot, isPending, isSuccess } = useForgotPassword();

  const forgotSchema = makeForgotSchema(t);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  const { register, handleSubmit: rhfHandleSubmit, formState: { errors } } = form;
  const handleForgotSubmit = rhfHandleSubmit((data) => handleForgot(data));

  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="flex w-full max-w-[360px] flex-col items-center gap-[18px] text-center">
          <span className="flex size-16 items-center justify-center rounded-full border border-success-border bg-success-subtle text-success">
            <Check className="size-[30px]" strokeWidth={2.4} aria-hidden />
          </span>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {t("auth.checkInbox")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("auth.checkInboxDesc")}
            </p>
          </div>
          <BackToLogin />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex w-full max-w-[360px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("auth.forgotTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.forgotDesc")}
          </p>
        </header>

        <form className="flex flex-col gap-6" onSubmit={handleForgotSubmit} noValidate>
          <TextField
            label={t("auth.email")}
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            error={errors.email?.message}
            {...register("email")}
          />

          <div className="flex flex-col gap-4">
            <AsyncButton
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isPending}
              loadingText={t("auth.sending")}
            >
              {t("auth.sendLink")}
            </AsyncButton>
            <div className="flex justify-center">
              <BackToLogin />
            </div>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}