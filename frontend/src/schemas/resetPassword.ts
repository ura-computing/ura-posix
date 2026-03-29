import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

export const resetPasswordSchema = z
  .object({
    new_password: z.string().min(6, "6 caractères minimum"),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function useResetPasswordForm() {
  return useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: "", confirm: "" },
  });
}
