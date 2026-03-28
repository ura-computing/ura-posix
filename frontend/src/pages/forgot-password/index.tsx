import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { forgotPassword } from "@/api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => forgotPassword(email),
    onSuccess: () => setSent(true),
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    mutate();
  };

  return (
    <div className="sign-in">
      <div className="logo">
        <img src="/logo.png" alt="PharmaGest" />
        <span className="brand-name">PharmaGest</span>
        <span className="brand-sub">Gestion Pharmacie</span>
      </div>

      <Card className="card">
        <CardHeader className="header">
          <CardTitle className="title">Mot de passe oublié</CardTitle>
          <CardDescription className="description">
            {sent
              ? "Vérifiez votre boîte mail"
              : "Entrez votre adresse email pour recevoir un lien de réinitialisation"}
          </CardDescription>
        </CardHeader>

        <CardContent className="content">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Un email de réinitialisation a été envoyé à <strong>{email}</strong>.
                <br />
                Vérifiez votre boîte de réception (et les spams).
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSent(false); setEmail(""); }}>
                Renvoyer un email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form">
              <div className="field space-y-1.5">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="submit" disabled={isPending || !email.trim()}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isPending ? "Envoi en cours..." : "Envoyer le lien"}
              </Button>
            </form>
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
