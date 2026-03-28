import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { PageLoader } from "@/components/shared/pageLoader";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { useUpdateMe } from "@/hooks/use-update-me";

const schema = z.object({
  name: z.string().min(2, "Nom requis"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Email invalide"),
  pharmacy_name: z.string().optional(),
  pharmacy_address: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { data: user, isLoading } = useMe();
  const { mutate: updateMe, isPending } = useUpdateMe();

  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", pharmacy_name: "", pharmacy_address: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        pharmacy_name: user.pharmacy_name ?? "",
        pharmacy_address: user.pharmacy_address ?? "",
      });
    }
  }, [user, form]);

  const onSubmit = (values: FormValues) => {
    updateMe(values, {
      onSuccess: () => toast.success("Profil mis à jour"),
      onError: (err) => toast.error(err.message),
    });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos informations personnelles</p>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Info section */}
          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Informations personnelles</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Mettez à jour vos coordonnées"
                  : isEmployee
                  ? "Mettez à jour vos coordonnées"
                  : "Mettez à jour vos coordonnées et les informations de votre pharmacie"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Jean Dupont" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input placeholder="+212 6 00 00 00 00" {...field} />
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
                        <Input placeholder="email@exemple.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Pharmacy section — role-aware */}
              {!isAdmin && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <p className="text-sm font-medium">Pharmacie</p>
                    {isEmployee ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Pharmacie associée</p>
                        <p className="text-sm font-medium">{user?.pharmacy_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          La pharmacie ne peut pas être modifiée après l'inscription.
                        </p>
                      </div>
                    ) : (
                      <>
                        <FormField
                          control={form.control}
                          name="pharmacy_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom de la pharmacie</FormLabel>
                              <FormControl>
                                <Input placeholder="Pharmacie Centrale" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pharmacy_address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Adresse</FormLabel>
                              <FormControl>
                                <Input placeholder="12 rue Mohammed V, Casablanca" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="min-w-32 gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
