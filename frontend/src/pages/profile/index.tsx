import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Camera, Loader2 } from "lucide-react";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import UploadWidget from "@/components/upload-widget";
import { useMe } from "@/hooks/use-me";
import { useUpdateMe } from "@/hooks/use-update-me";

const schema = z.object({
  name: z.string().min(2, "Nom requis"),
  phone: z.string().min(8, "Numéro invalide"),
  pharmacy_name: z.string().min(2, "Nom de la pharmacie requis"),
  image_url: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { data: user, isLoading } = useMe();
  const { mutate: updateMe, isPending } = useUpdateMe();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", pharmacy_name: "", image_url: "" },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? "",
        phone: user.phone ?? "",
        pharmacy_name: user.pharmacy_name ?? "",
        image_url: user.image_url ?? "",
      });
    }
  }, [user, form]);

  const onSubmit = (values: FormValues) => {
    updateMe(values, {
      onSuccess: () => toast.success("Profil mis à jour"),
      onError: (err) => toast.error(err.message),
    });
  };

  const imageUrl = form.watch("image_url");
  const initials = (user?.name ?? "U").slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos informations personnelles</p>
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar section */}
          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Photo de profil</CardTitle>
              <CardDescription>Elle apparaît dans l'en-tête de l'application</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 ring-2 ring-border">
                    <AvatarImage src={imageUrl} alt={user?.name} />
                    <AvatarFallback className="bg-teal-500 text-white text-xl font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center">
                    <Camera className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="image_url"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <UploadWidget
                          value={field.value ? { url: field.value, publicId: "" } : null}
                          onChange={(file) => field.onChange(file?.url ?? "")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Info section */}
          <Card className="border border-border rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Informations personnelles</CardTitle>
              <CardDescription>Mettez à jour vos coordonnées et le nom de votre pharmacie</CardDescription>
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
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <Input value={user?.email ?? ""} disabled className="bg-muted/50" />
                </FormItem>
              </div>

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
