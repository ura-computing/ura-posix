import { useSearchParams, useNavigate, Link } from "react-router";
import { useResetPasswordForm } from "@/schemas/resetPassword";
import type { ResetPasswordFormValues } from "@/schemas/resetPassword";
import { Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { InputPassword } from "@/components/refine-ui/form/inputPassword";
import { Separator } from "@/components/ui/separator";
import { useAuthenticate } from "@/hooks/useAuthenticate";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const form = useResetPasswordForm();
  const { resetPassword: { submit, resetPending, resetIsError, resetError } } = useAuthenticate();

  const handleReset = (values: ResetPasswordFormValues) => {
    submit({ token, newPassword: values.new_password }, {
      onSuccess: () => {
        navigate("/login");
      },
    });
  };

  if (!token) {
    return (
      <div className="login">
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
    <div className="login">
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
          {resetIsError ? (
            <div className="flex flex-col items-center gap-3 text-center py-4">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-medium text-destructive">{resetError?.message}</p>
              <Link to="/forgot-password" className="text-sm text-primary underline">
                Demander un nouveau lien
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleReset)} className="form">
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
                <Button type="submit" size="lg" className="submit" disabled={resetPending}>
                  {resetPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {resetPending ? "Enregistrement..." : "Modifier le mot de passe"}
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
