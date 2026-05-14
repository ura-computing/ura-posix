import { Link } from "react-router";
import { useAuthenticate } from "@/hooks/useAuthenticate";
import { useSignupForm } from "@/schemas/signupForm";
import type { SignupFormValues } from "@/schemas/signupForm";
import { Loader2, PlusCircle, LogIn } from "lucide-react";
import { useState, useEffect } from "react";
import { AppLogo } from "@/components/shared/appLogo";
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
import { InputPassword } from "@/components/inputPassword";
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
import { cn } from "@/utils/cn";
import { listPharmacies as listPublicPharmacies } from "@/api/public";
import type { PharmacyPublic } from "@/api/public";

export const Signup = () => {
  const { signup: { submit: signup, signupPending } } = useAuthenticate();
  const [pharmacies, setPharmacies] = useState<PharmacyPublic[]>([]);
  const form = useSignupForm();

  const [ownerMode, setOwnerMode] = useState<"new" | "join">("new");

  useEffect(() => {
    listPublicPharmacies().then(setPharmacies).catch(() => {});
  }, []);

  useEffect(() => {
    if (ownerMode === "new") {
      form.setValue("pharmacy_id", undefined);
    } else {
      form.setValue("pharmacy_name", undefined);
      form.setValue("pharmacy_city", undefined);
    }
  }, [ownerMode, form]);

  const onSubmit = (values: SignupFormValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...payload } = values;
    signup(payload as Parameters<typeof signup>[0]);
  };

  return (
    <div className="signup">
      <div className="logo">
        <AppLogo />
        <span className="brand-name">PharmaGest</span>
        <span className="brand-sub">Gestion Pharmacie</span>
      </div>

      <Card className="card">
        <CardHeader className="header">
          <CardTitle className="title">Créer un compte propriétaire</CardTitle>
          <CardDescription className="description">
            Inscrivez votre pharmacie sur PharmaGest. Les employés doivent être invités par un propriétaire.
          </CardDescription>
        </CardHeader>

        <CardContent className="content">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="form">

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

              <div className="space-y-3">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <FormField
                      control={form.control}
                      name="pharmacy_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ville</FormLabel>
                          <FormControl>
                            <Input placeholder="Bouskoura" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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

              <Button type="submit" size="lg" className="submit" disabled={signupPending}>
                {signupPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {signupPending ? "Création..." : "Créer mon compte"}
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
