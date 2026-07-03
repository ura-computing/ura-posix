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

const profileSchema = z.object({
  name:  z.string().min(1, "Le nom est requis."),
  phone: z.string().refine((v) => isValidPhoneNumber(v), "Numéro de téléphone invalide."),
});
type ProfileValues = z.infer<typeof profileSchema>;

export function ProfileTab({ me }: { me: Me }) {
  const { handleUpdate, isPending } = useUpdateProfile();

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me.name, phone: me.phone ?? "" },
  });
  const { register, control, handleSubmit: rhfHandleSubmit, formState: { errors } } = form;
  const handleProfileSubmit = rhfHandleSubmit((data) => handleUpdate(data));

  return (
    <form className="flex max-w-[480px] flex-col gap-5" onSubmit={handleProfileSubmit} noValidate>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profil</h2>

      <TextField
        label="Email"
        value={me.email}
        disabled
        readOnly
        rightSlot={<Lock className="size-4 text-muted-foreground" aria-hidden />}
        hint="L'email ne peut pas être modifié (clé de connexion)"
      />

      <TextField
        label="Nom complet"
        error={errors.name?.message}
        {...register("name")}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <PhoneField
            label="Téléphone"
            value={field.value}
            onChange={field.onChange}
            error={errors.phone?.message}
          />
        )}
      />

      <div className="flex justify-end">
        <AsyncButton type="submit" variant="primary" isLoading={isPending} loadingText="Enregistrement…">
          Enregistrer
        </AsyncButton>
      </div>
    </form>
  );
}