import { useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import UploadWidget from "@/components/upload-widget";
import { useUpdateMe } from "@/hooks/use-update-me";

const STEPS = ["Photo de profil", "Terminé"] as const;

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { mutate: updateProfile, isPending } = useUpdateMe();

  const handleSave = () => {
    updateProfile(
      photoUrl ? { image_url: photoUrl } : {},
      { onSuccess: () => setStep(1) }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="PharmaGest" className="h-10 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Configurez votre profil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Une dernière étape avant d'accéder au tableau de bord
        </p>
      </div>

      {/* Stepper indicator */}
      <div className="flex items-center gap-0 mb-8 w-full max-w-md">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                  i < step
                    ? "bg-teal-500 border-teal-500 text-white"
                    : i === step
                    ? "border-teal-500 text-teal-600 bg-background"
                    : "border-border text-muted-foreground bg-background"
                )}
              >
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium hidden sm:block", i === step ? "text-teal-600" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-2 mb-5", i < step ? "bg-teal-500" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <Card className="w-full max-w-md">
        {/* Step 0 — Profile photo */}
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle>Photo de profil</CardTitle>
              <CardDescription>
                Elle sera affichée en haut de l'en-tête. Vous pouvez ignorer cette étape.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UploadWidget
                value={photoUrl ? { url: photoUrl, publicId: "" } : null}
                onChange={(file) => setPhotoUrl(file?.url ?? null)}
              />
              <Button
                className="w-full gap-2"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? "Enregistrement..." : "Continuer"}
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 1 — Done */}
        {step === 1 && (
          <>
            <CardHeader className="items-center text-center">
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-8 w-8 text-teal-500" />
              </div>
              <CardTitle>Profil complété !</CardTitle>
              <CardDescription>
                Votre profil est configuré. Bienvenue sur PharmaGest.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/", { replace: true })}>
                Accéder au tableau de bord
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
