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

import { useLogin } from "@/pages/login/_hooks/useLogin";

const loginSchema = z.object({
  email:    z.string().min(1, "L'email est requis.").email("Format d'email invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { handleLogin, isPending } = useLogin();

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
            Connexion
          </h1>
          <p className="text-sm text-muted-foreground">
            Accédez à votre espace PharmaGest.
          </p>
        </header>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.ma"
            error={errors.email?.message}
            {...register("email")}
          />

          <PasswordField
            label="Mot de passe"
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
              loadingText="Connexion…"
            >
              Se connecter
            </AsyncButton>

            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className={cn(
                "text-center text-[13px] font-semibold text-primary",
                "transition-colors hover:text-primary-hover",
              )}
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}