import { useRegister, useLink } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Building2, UserCog, PlusCircle, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { InputPassword } from "@/components/refine-ui/form/input-password";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { PharmacyPublic } from "@/lib/api";
import { eUserRole } from "@/types";

const schema = z.object({
  name: z.string().min(3, "Le nom doit comporter au moins 3 caractères"),
  email: z.string().email("Adresse email invalide"),
  phone: z.string().min(8, "Numéro de téléphone invalide"),
  password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères"),
  confirmPassword: z.string(),
  role: z.enum([eUserRole.OWNER, eUserRole.EMPLOYEE]),
  pharmacy_name: z.string().optional(),
  pharmacy_id: z.number().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.role === eUserRole.EMPLOYEE) return !!data.pharmacy_id;
  return true;
}, {
  message: "Veuillez sélectionner une pharmacie",
  path: ["pharmacy_id"],
}).refine((data) => {
  if (data.role === eUserRole.OWNER && !data.pharmacy_id) return !!data.pharmacy_name?.trim();
  return true;
}, {
  message: "Veuillez saisir le nom de votre pharmacie",
  path: ["pharmacy_name"],
});

type FormValues = z.infer<typeof schema>;

export const SignUpForm = () => {
  const Link = useLink();
  const { mutate: register, isPending } = useRegister();
  const [pharmacies, setPharmacies] = useState<PharmacyPublic[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "", role: eUserRole.OWNER },
  });

  const role = form.watch("role");
  const [ownerMode, setOwnerMode] = useState<"new" | "join">("new");

  useEffect(() => {
    api.public.listPharmacies().then(setPharmacies).catch(() => {});
  }, []);

  // Clear stale pharmacy fields when mode or role changes
  useEffect(() => {
    if (role === eUserRole.OWNER) {
      if (ownerMode === "new") {
        form.setValue("pharmacy_id", undefined);
      } else {
        form.setValue("pharmacy_name", undefined);
      }
    }
  }, [role, ownerMode, form]);

  const onSubmit = (values: FormValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...payload } = values;
    register(payload, {
      onSuccess: (data) => {
        if (!data.success) {
          toast.error(data.error?.message, { richColors: true });
        }
      },
    });
  };

  return (
    <div className="sign-up">
      <div className="logo">
        <img src="/logo.png" alt="PharmaGest" />
        <span className="brand-name">PharmaGest</span>
        <span className="brand-sub">Gestion Pharmacie</span>
      </div>

      <Card className="card">
        <CardHeader className="header">
          <CardTitle className="title">Créer un compte</CardTitle>
          <CardDescription className="description">
            Commencez avec PharmaGest
          </CardDescription>
        </CardHeader>

        <CardContent className="content">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="form">

              {/* Role selector */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Je suis</p>
                <div className="grid grid-cols-2 gap-3">
                  {([eUserRole.OWNER, eUserRole.EMPLOYEE] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => form.setValue("role", r)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all",
                        role === r
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      {r === eUserRole.OWNER
                        ? <Building2 className="h-5 w-5" />
                        : <UserCog className="h-5 w-5" />
                      }
                      {r === eUserRole.OWNER ? "Propriétaire" : "Employé"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row: Nom + Téléphone */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet</FormLabel>
                      <FormControl>
                        <Input placeholder="Jean Dupont" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input placeholder="+212 6 00 00 00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="votre@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Row: Mot de passe + Confirmer */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
                      <FormControl>
                        <InputPassword placeholder="8 caractères min." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmer</FormLabel>
                      <FormControl>
                        <InputPassword placeholder="Répétez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Conditional field based on role */}
              {role === eUserRole.OWNER ? (
                <div className="space-y-3">
                  {/* Owner mode toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOwnerMode("new")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        ownerMode === "new"
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Nouvelle pharmacie
                    </button>
                    <button
                      type="button"
                      onClick={() => setOwnerMode("join")}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                        ownerMode === "join"
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                          : "border-border text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Rejoindre existante
                    </button>
                  </div>

                  {ownerMode === "new" ? (
                    <FormField
                      control={form.control}
                      name="pharmacy_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom de votre pharmacie</FormLabel>
                          <FormControl>
                            <Input placeholder="Pharmacie Al Amal" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="pharmacy_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pharmacie à rejoindre</FormLabel>
                          <Select
                            value={field.value?.toString() ?? ""}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez une pharmacie" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {pharmacies.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="pharmacy_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pharmacie où vous travaillez</FormLabel>
                      <Select
                        value={field.value?.toString() ?? ""}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionnez une pharmacie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pharmacies.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                              Aucune pharmacie disponible. Le propriétaire doit d'abord créer son compte.
                            </div>
                          ) : pharmacies.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button type="submit" size="lg" className="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isPending ? "Création..." : "Créer mon compte"}
              </Button>
            </form>
          </Form>
        </CardContent>

        <Separator className="divider" />

        <CardFooter className="footer">
          <span>Déjà un compte ?</span>
          <Link to="/login">Se connecter</Link>
        </CardFooter>
      </Card>
    </div>
  );
};
