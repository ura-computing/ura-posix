import { Link } from "react-router";
import { useAuthenticate } from "@/hooks/useAuthenticate";
import { useLoginForm } from "@/schemas/loginForm";
import type { LoginFormValues } from "@/schemas/loginForm";
import { Loader2 } from "lucide-react";

import { InputPassword } from "@/components/refine-ui/form/inputPassword";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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

export const LoginForm = () => {
  const { login: { submit: login, loginPending } } = useAuthenticate();
  const form = useLoginForm();

  const onSubmit = (values: LoginFormValues) => {
    login({ email: values.email, password: values.password });
  };

  return (
    <div className="login">
      <div className="logo">
        <img src="/logo.png" alt="PharmaGest" />
        <span className="brand-name">PharmaGest</span>
        <span className="brand-sub">Gestion Pharmacie</span>
      </div>

      <Card className="card">
        <CardHeader className="header">
          <CardTitle className="title">Connexion</CardTitle>
          <CardDescription className="description">
            Bienvenue sur PharmaGest
          </CardDescription>
        </CardHeader>

        <CardContent className="content">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="form">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="field">
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
                  <FormItem className="field">
                    <div className="flex items-center justify-between">
                      <FormLabel>Mot de passe</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-muted-foreground hover:underline"
                        tabIndex={-1}
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <FormControl>
                      <InputPassword id="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" size="lg" className="submit" disabled={loginPending}>
                {loginPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {loginPending ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </Form>
        </CardContent>

        <Separator className="divider" />

        <CardFooter className="footer">
          <span>Pas de compte ?</span>
          <Link to="/signup">Créer un compte</Link>
        </CardFooter>
      </Card>
    </div>
  );
};

LoginForm.displayName = "LoginForm";
