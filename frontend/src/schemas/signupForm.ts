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
    pharmacy_code: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
  // Employees MUST provide a pharmacy code (they cannot create a new pharmacy).
  .refine(
    (data) => data.role !== eUserRole.EMPLOYEE || !!data.pharmacy_code?.trim(),
    { message: "Code de pharmacie requis", path: ["pharmacy_code"] }
  )
  // Owner: either pharmacy_code (joining existing) OR pharmacy_name + pharmacy_city (new).
  .refine(
    (data) => {
      if (data.role !== eUserRole.OWNER) return true;
      if (data.pharmacy_code?.trim()) return true;
      return !!data.pharmacy_name?.trim();
    },
    { message: "Nom de pharmacie requis", path: ["pharmacy_name"] }
  )
  .refine(
    (data) => {
      if (data.role !== eUserRole.OWNER) return true;
      if (data.pharmacy_code?.trim()) return true;
      return !!data.pharmacy_city?.trim();
    },
    { message: "Ville requise", path: ["pharmacy_city"] }
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
