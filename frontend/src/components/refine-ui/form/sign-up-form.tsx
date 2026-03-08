import { useRegister, useLink } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Building2, UserCog } from "lucide-react";
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

const schema = z.object({
  name: z.string().min(3, "Le nom doit comporter au moins 3 caractères"),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères"),
  role: z.enum(["owner", "employee"]),
  pharmacy_name: z.string().optional(),
  pharmacy_id: z.number().optional(),
});

type FormValues = z.infer<typeof schema>;

export const SignUpForm = () => {
  const Link = useLink();
  const { mutate: register, isPending } = useRegister();
  const [pharmacies, setPharmacies] = useState<PharmacyPublic[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", role: "owner" },
  });

  const role = form.watch("role");

  useEffect(() => {
    api.public.listPharmacies().then(setPharmacies).catch(() => {});
  }, []);

  const onSubmit = (values: FormValues) => {
    register(values, {
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
                  {(["owner", "employee"] as const).map((r) => (
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
                      {r === "owner"
                        ? <Building2 className="h-5 w-5" />
                        : <UserCog className="h-5 w-5" />
                      }
                      {r === "owner" ? "Propriétaire" : "Employé"}
                    </button>
                  ))}
                </div>
              </div>

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

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <InputPassword placeholder="Au moins 8 caractères" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional field based on role */}
              {role === "owner" ? (
                <FormField
                  control={form.control}
                  name="pharmacy_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom de votre pharmacie</FormLabel>
                      <FormControl>
                        <Input placeholder="Pharmacie Al Amal" {...field} />
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
