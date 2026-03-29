import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Loader2, Mail, MessageCircle } from "lucide-react";

import { AppLogo } from "@/components/shared/appLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthenticate } from "@/hooks/useAuthenticate";
import { cn } from "@/utils/cn";

type Method = "email" | "whatsapp";
type Step = "input" | "sent" | "otp";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("email");
  const [step, setStep] = useState<Step>("input");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const {
    forgotPassword: { submit: submitEmail, forgotPending },
    forgotPasswordWhatsApp: { submit: submitWhatsApp, forgotWhatsAppPending },
    verifyOtp: { submit: submitOtp, verifyOtpPending },
  } = useAuthenticate();

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    submitEmail(email, { onSuccess: () => setStep("sent") });
  };

  const handleWhatsAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    submitWhatsApp(phone, { onSuccess: () => setStep("otp") });
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    submitOtp(
      { phone, otp },
      { onSuccess: (data) => navigate(`/reset-password?token=${data.reset_token}`) },
    );
  };

  const resetForm = () => {
    setStep("input");
    setEmail("");
    setPhone("");
    setOtp("");
  };

  const description =
    step === "sent" ? "Vérifiez votre boîte mail" :
    step === "otp" ? "Entrez le code reçu sur WhatsApp" :
    method === "email"
      ? "Entrez votre adresse email pour recevoir un lien de réinitialisation"
      : "Entrez votre numéro de téléphone pour recevoir un code via WhatsApp";

  return (
    <div className="login">
      <div className="logo">
        <AppLogo />
        <span className="brand-name">APCM Pharma</span>
        <span className="brand-sub">Gestion Pharmacie</span>
      </div>

      <Card className="card">
        <CardHeader className="header">
          <CardTitle className="title">Mot de passe oublié</CardTitle>
          <CardDescription className="description">{description}</CardDescription>
        </CardHeader>

        <CardContent className="content">
          {/* Method toggle — only show on input step */}
          {step === "input" && (
            <div className="flex items-center gap-1 border rounded-xl p-1 bg-muted/30 mb-4">
              <button
                type="button"
                onClick={() => { setMethod("email"); setPhone(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-colors",
                  method === "email" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => { setMethod("whatsapp"); setEmail(""); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition-colors",
                  method === "whatsapp" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>
            </div>
          )}

          {/* Email sent confirmation */}
          {step === "sent" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Un email de réinitialisation a été envoyé à <strong>{email}</strong>.
                <br />
                Vérifiez votre boîte de réception (et les spams).
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={resetForm}>
                Renvoyer un email
              </Button>
            </div>
          )}

          {/* Email form */}
          {step === "input" && method === "email" && (
            <form onSubmit={handleEmailSubmit} className="form">
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
              <Button type="submit" size="lg" className="submit" disabled={forgotPending || !email.trim()}>
                {forgotPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {forgotPending ? "Envoi en cours..." : "Envoyer le lien"}
              </Button>
            </form>
          )}

          {/* WhatsApp phone form */}
          {step === "input" && method === "whatsapp" && (
            <form onSubmit={handleWhatsAppSubmit} className="form">
              <div className="field space-y-1.5">
                <Label htmlFor="phone">Numéro de téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0600000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="submit" disabled={forgotWhatsAppPending || !phone.trim()}>
                {forgotWhatsAppPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {forgotWhatsAppPending ? "Envoi en cours..." : "Envoyer le code WhatsApp"}
              </Button>
            </form>
          )}

          {/* OTP verification form */}
          {step === "otp" && (
            <form onSubmit={handleOtpSubmit} className="form">
              <div className="flex flex-col items-center gap-3 pb-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Un code à 6 chiffres a été envoyé sur WhatsApp au <strong>{phone}</strong>
                </p>
              </div>
              <div className="field space-y-1.5">
                <Label htmlFor="otp">Code de vérification</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  autoFocus
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              <Button type="submit" size="lg" className="submit" disabled={verifyOtpPending || otp.length !== 6}>
                {verifyOtpPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {verifyOtpPending ? "Vérification..." : "Vérifier le code"}
              </Button>
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={resetForm}>
                Changer de méthode
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
