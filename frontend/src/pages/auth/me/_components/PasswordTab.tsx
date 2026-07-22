import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { PasswordField } from "@/components/shared/PasswordField";

import { useChangePassword } from "../_hooks/useChangePassword";
import { useT } from "@/i18n/I18nProvider";

const makePasswordSchema = (t: (k: string) => string) => z
  .object({
    current_password: z.string().min(1, t("me.currentRequired")),
    new_password:     z.string().min(8, t("me.min8chars")),
    confirm_password: z.string().min(1, t("me.confirmRequired")),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: t("me.passwordMismatch"),
    path:    ["confirm_password"],
  });

type PasswordValues = z.infer<ReturnType<typeof makePasswordSchema>>;

export function PasswordTab() {
  const t = useT();
  const form = useForm<PasswordValues>({
    resolver: zodResolver(makePasswordSchema(t)),
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
        {t("me.changePassword")}
      </h2>

      <PasswordField
        label={t("me.currentPassword")}
        autoComplete="current-password"
        error={errors.current_password?.message}
        {...register("current_password")}
      />

      <PasswordField
        label={t("me.newPassword")}
        autoComplete="new-password"
        hint={t("me.min8")}
        error={errors.new_password?.message}
        {...register("new_password")}
      />

      <PasswordField
        label={t("me.confirmPassword")}
        autoComplete="new-password"
        error={errors.confirm_password?.message}
        {...register("confirm_password")}
      />

      <div className="flex justify-end">
        <AsyncButton type="submit" variant="primary" isLoading={isPending} loadingText={t("me.changing")}>
          {t("me.change")}
        </AsyncButton>
      </div>
    </form>
  );
}