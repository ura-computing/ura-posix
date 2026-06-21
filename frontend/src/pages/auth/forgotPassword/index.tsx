import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { TextField } from "@/components/shared/TextField";
import { ROUTES } from "@/types";

import { useForgotPassword } from "./_hooks/useForgotPassword";

const forgotSchema = z.object({
  email: z.string().min(1, "L'email est requis.").email("Format d'email invalide."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

function BackToLogin() {
  return (
    <Link
      to={ROUTES.LOGIN}
      className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Retour à la connexion
    </Link>
  );
}

export default function ForgotPasswordPage() {
  const { handleForgot, isPending, isSuccess } = useForgotPassword();

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
              Vérifiez votre boîte de réception
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Si votre compte existe, vous recevrez un email avec un lien.
              Vérifiez aussi vos spams.
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
            Mot de passe oublié
          </h1>
          <p className="text-sm text-muted-foreground">
            Entrez votre email, vous recevrez un lien pour réinitialiser votre mot de passe.
          </p>
        </header>

        <form className="flex flex-col gap-6" onSubmit={handleForgotSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.ma"
            error={errors.email?.message}
            {...register("email")}
          />

          <div className="flex flex-col gap-4">
            <AsyncButton
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isPending}
              loadingText="Envoi…"
            >
              Envoyer le lien
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