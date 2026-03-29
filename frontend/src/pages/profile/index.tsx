import { useEffect } from "react";
import { useProfileForm } from "@/schemas/profile";
import type { ProfileFormValues } from "@/schemas/profile";
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
import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";
import { eUserRole } from "@/types";

export default function ProfilePage() {
  const { me: user, meLoading: isLoading } = useMe();
  const { updateMe, updateMePending } = useUpdateMe();

  const isAdmin = user?.role === eUserRole.ADMIN;
  const isEmployee = user?.role === eUserRole.EMPLOYEE;

  const form = useProfileForm();

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

  const onSubmit = (values: ProfileFormValues) => {
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
            <Button type="submit" disabled={updateMePending} className="min-w-32 gap-2">
              {updateMePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {updateMePending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
