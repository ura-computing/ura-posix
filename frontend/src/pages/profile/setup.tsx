import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2 } from "lucide-react";

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
import { cn } from "@/lib/utils";
import UploadWidget from "@/components/upload-widget";
import { useUpdateMe } from "@/hooks/use-update-me";

const STEPS = ["Informations", "Photo de profil", "Terminé"] as const;

// Step 1 schema
const step1Schema = z.object({
  name: z.string().min(2, "Nom requis"),
  phone: z.string().min(8, "Numéro de téléphone invalide"),
  pharmacy_name: z.string().min(2, "Nom de la pharmacie requis"),
});

type Step1Values = z.infer<typeof step1Schema>;

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);

  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: "", phone: "", pharmacy_name: "" },
  });

  const { mutate: updateProfile, isPending } = useUpdateMe();

  const handleStep1 = (values: Step1Values) => {
    setStep1Data(values);
    setStep(1);
  };

  const handleStep2 = () => {
    if (!step1Data) return;
    updateProfile(
      { ...step1Data, ...(photoUrl ? { image_url: photoUrl } : {}) },
      { onSuccess: () => setStep(2) }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="PharmaGest" className="h-10 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Configurez votre profil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quelques informations pour personnaliser votre expérience
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
        {/* Step 0 — Personal info */}
        {step === 0 && (
          <>
            <CardHeader>
              <CardTitle>Informations personnelles</CardTitle>
              <CardDescription>Ces informations apparaîtront sur votre profil</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleStep1)} className="space-y-4">
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
                  <Button type="submit" className="w-full mt-2">
                    Continuer
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        )}

        {/* Step 1 — Profile photo */}
        {step === 1 && (
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
              <div className="flex gap-3 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                  Retour
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleStep2}
                  disabled={isPending}
                >
                  {isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2 — Done */}
        {step === 2 && (
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
