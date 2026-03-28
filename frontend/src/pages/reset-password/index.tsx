import { useSearchParams, useNavigate, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputPassword } from "@/components/refine-ui/form/input-password";
import { Separator } from "@/components/ui/separator";
import { resetPassword } from "@/api/auth";

const schema = z
  .object({
    new_password: z.string().min(6, "6 caractères minimum"),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "", confirm: "" },
  });

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: (values: FormValues) => resetPassword(token, values.new_password),
    onSuccess: () => {
      toast.success("Mot de passe modifié — vous pouvez vous connecter");
      navigate("/login");
    },
  });

  if (!token) {
    return (
      <div className="sign-in">
        <Card className="card">
          <CardContent className="content pt-6">
            <div className="flex flex-col items-center gap-3 text-center py-4">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium">Lien invalide ou manquant.</p>
              <Link to="/forgot-password" className="text-sm text-primary underline">
                Demander un nouveau lien
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="sign-in">
      <div className="logo">
        <img src="/logo.png" alt="PharmaGest" />
        <span className="brand-name">PharmaGest</span>
        <span className="brand-sub">Gestion Pharmacie</span>
      </div>

      <Card className="card">
        <CardHeader className="header">
          <CardTitle className="title">Nouveau mot de passe</CardTitle>
          <CardDescription className="description">
            Choisissez un nouveau mot de passe pour votre compte.
          </CardDescription>
        </CardHeader>

        <CardContent className="content">
          {isError ? (
            <div className="flex flex-col items-center gap-3 text-center py-4">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error.message}</p>
              <Link to="/forgot-password" className="text-sm text-primary underline">
                Demander un nouveau lien
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => mutate(v))} className="form">
                <FormField
                  control={form.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem className="field">
                      <FormLabel>Nouveau mot de passe</FormLabel>
                      <FormControl>
                        <InputPassword id="new_password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirm"
                  render={({ field }) => (
                    <FormItem className="field">
                      <FormLabel>Confirmer le mot de passe</FormLabel>
                      <FormControl>
                        <InputPassword id="confirm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="lg" className="submit" disabled={isPending}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isPending ? "Enregistrement..." : "Modifier le mot de passe"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        <Separator className="divider" />

        <CardFooter className="footer">
          <span>Retour à la</span>
          <Link to="/login">connexion</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
