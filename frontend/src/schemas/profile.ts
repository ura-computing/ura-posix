import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

export const profileSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email invalide"),
  pharmacy_name: z.string().optional(),
  pharmacy_address: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function useProfileForm() {
  return useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", phone: "", email: "", pharmacy_name: "", pharmacy_address: "" },
  });
}
