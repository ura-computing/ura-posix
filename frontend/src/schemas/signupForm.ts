import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { eUserRole } from "@/types";

export const signupSchema = z
  .object({
    name: z.string().min(3, "Le nom doit comporter au moins 3 caractères"),
    email: z.string().email("Adresse email invalide"),
    phone: z.string().min(8, "Numéro de téléphone invalide"),
    password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères"),
    confirmPassword: z.string(),
    role: z.enum([eUserRole.OWNER, eUserRole.EMPLOYEE]),
    pharmacy_name: z.string().optional(),
    pharmacy_city: z.string().optional(),
    pharmacy_id: z.number().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      if (data.role === eUserRole.EMPLOYEE) return !!data.pharmacy_id;
      return true;
    },
    { message: "Veuillez sélectionner une pharmacie", path: ["pharmacy_id"] }
  )
  .refine(
    (data) => {
      if (data.role === eUserRole.OWNER && !data.pharmacy_id) return !!data.pharmacy_name?.trim();
      return true;
    },
    { message: "Veuillez saisir le nom de votre pharmacie", path: ["pharmacy_name"] }
  )
  .refine(
    (data) => {
      if (data.role === eUserRole.OWNER && !data.pharmacy_id) return !!data.pharmacy_city?.trim();
      return true;
    },
    { message: "Veuillez saisir la ville de votre pharmacie", path: ["pharmacy_city"] }
  );

export type SignupFormValues = z.infer<typeof signupSchema>;

export function useSignupForm() {
  return useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: eUserRole.OWNER,
    },
  });
}
