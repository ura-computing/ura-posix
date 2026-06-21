import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { PasswordField } from "@/components/shared/PasswordField";

import { useChangePassword } from "../_hooks/useChangePassword";

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Le mot de passe actuel est requis."),
    new_password:     z.string().min(8, "Minimum 8 caractères."),
    confirm_password: z.string().min(1, "Veuillez confirmer le mot de passe."),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Les mots de passe ne correspondent pas.",
    path:    ["confirm_password"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export function PasswordTab() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });
  const { register, handleSubmit: rhfHandleSubmit, reset, formState: { errors } } = form;

  const { handleChange, isPending } = useChangePassword(() => reset());

  const handlePasswordSubmit = rhfHandleSubmit((data) =>
    handleChange({ current_password: data.current_password, new_password: data.new_password }),
  );

  return (
    <form className="flex max-w-[480px] flex-col gap-5" onSubmit={handlePasswordSubmit} noValidate>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Changer mon mot de passe
      </h2>

      <PasswordField
        label="Mot de passe actuel"
        autoComplete="current-password"
        error={errors.current_password?.message}
        {...register("current_password")}
      />

      <PasswordField
        label="Nouveau mot de passe"
        autoComplete="new-password"
        hint="Minimum 8 caractères"
        error={errors.new_password?.message}
        {...register("new_password")}
      />

      <PasswordField
        label="Confirmer le nouveau mot de passe"
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...register("confirm_password")}
      />

      <div className="flex justify-end">
        <AsyncButton type="submit" variant="primary" isLoading={isPending} loadingText="Modification…">
          Changer
        </AsyncButton>
      </div>
    </form>
  );
}