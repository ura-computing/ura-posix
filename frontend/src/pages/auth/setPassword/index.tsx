import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { TriangleAlert } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { PasswordField } from "@/components/shared/PasswordField";
import { ROUTES } from "@/types";

import { useSetPassword } from "./_hooks/useSetPassword";
import { useValidateToken } from "./_hooks/useValidateToken";

const setPasswordSchema = z
  .object({
    password:        z.string().min(8, "Minimum 8 caractères."),
    confirmPassword: z.string().min(1, "Veuillez confirmer le mot de passe."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path:    ["confirmPassword"],
  });

type SetPasswordValues = z.infer<typeof setPasswordSchema>;

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
  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-[18px] text-center">
      <span className="flex size-16 items-center justify-center rounded-full border border-warning-border bg-warning-subtle text-warning">
        <TriangleAlert className="size-[30px]" strokeWidth={2.2} aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Lien expiré</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ce lien d&apos;activation n&apos;est plus valide.
        </p>
      </div>
      <Link
        to={ROUTES.FORGOT_PASSWORD}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        Demander un nouveau lien
      </Link>
    </div>
  );
}

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { isValidating, isValid, isSetup, fullName } = useValidateToken(token);
  const { handleSetPassword, isPending } = useSetPassword(token);

  const form = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { register, handleSubmit: rhfHandleSubmit, formState: { errors } } = form;
  const handleSetPasswordSubmit = rhfHandleSubmit((data) => handleSetPassword({ password: data.password }));

  if (isValidating) return <AuthLayout><FormSkeleton /></AuthLayout>;
  if (!isValid)     return <AuthLayout><ExpiredState /></AuthLayout>;

  return (
    <AuthLayout>
      <div className="flex w-full max-w-[360px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSetup ? `Bienvenue, ${fullName}` : "Réinitialiser votre mot de passe"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSetup
              ? "Choisissez un mot de passe pour activer votre compte."
              : "Choisissez un nouveau mot de passe."}
          </p>
        </header>

        <form className="flex flex-col gap-6" onSubmit={handleSetPasswordSubmit} noValidate>
          <PasswordField
            label="Nouveau mot de passe"
            autoComplete="new-password"
            hint="Minimum 8 caractères"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordField
            label={isSetup ? "Confirmer le mot de passe" : "Confirmer le nouveau mot de passe"}
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
          <AsyncButton
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isPending}
            loadingText={isSetup ? "Activation…" : "Réinitialisation…"}
          >
            {isSetup ? "Activer mon compte" : "Réinitialiser mon mot de passe"}
          </AsyncButton>
        </form>
      </div>
    </AuthLayout>
  );
}