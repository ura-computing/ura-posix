import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { Lock } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { PhoneField } from "@/components/shared/PhoneField";
import { TextField } from "@/components/shared/TextField";
import type { Me } from "@/types";

import { useUpdateProfile } from "../_hooks/useUpdateProfile";
import { useT } from "@/i18n/I18nProvider";

const makeProfileSchema = (t: (k: string) => string) => z.object({
  name:  z.string().min(1, t("me.nameRequired")),
  phone: z.string().refine((v) => isValidPhoneNumber(v), t("me.phoneInvalid")),
});
type ProfileValues = z.infer<ReturnType<typeof makeProfileSchema>>;

export function ProfileTab({ me }: { me: Me }) {
  const t = useT();
  const { handleUpdate, isPending } = useUpdateProfile();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(makeProfileSchema(t)),
    defaultValues: { name: me.name, phone: me.phone ?? "" },
  });
  const { register, control, handleSubmit: rhfHandleSubmit, formState: { errors } } = form;
  const handleProfileSubmit = rhfHandleSubmit((data) => handleUpdate(data));

  return (
    <form className="flex max-w-[480px] flex-col gap-5" onSubmit={handleProfileSubmit} noValidate>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("me.profil")}</h2>

      <TextField
        label={t("me.email")}
        value={me.email}
        disabled
        readOnly
        rightSlot={<Lock className="size-4 text-muted-foreground" aria-hidden />}
        hint={t("me.emailHint")}
      />

      <TextField
        label={t("me.fullName")}
        error={errors.name?.message}
        {...register("name")}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <PhoneField
            label={t("me.phone")}
            value={field.value}
            onChange={field.onChange}
            error={errors.phone?.message}
          />
        )}
      />

      <div className="flex justify-end">
        <AsyncButton type="submit" variant="primary" isLoading={isPending} loadingText={t("me.saving")}>
          {t("me.save")}
        </AsyncButton>
      </div>
    </form>
  );
}