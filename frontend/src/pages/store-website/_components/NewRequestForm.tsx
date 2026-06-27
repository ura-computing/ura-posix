import { useState, type ReactNode } from "react";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { URGENCY_LABEL, type BrandColors, type Urgency } from "@/types/storeWebsite";


/** /store-website/new — single-page form (not multi-step).
 *
 *  Validation:
 *    - storeName + phone required
 *    - phone = Moroccan format (+212 / 0X with 9 digits)
 *    - logo: PNG / SVG / JPG only, max 2 MB
 *    - 2-3 brand colors
 *    - submit disabled while invalid */

export interface NewRequestValues {
  storeName:    string;
  slogan:       string;
  logoFile:     File | null;
  brand:        BrandColors;
  phone:        string;
  customDomain: string;
  urgency:      Urgency;
  vision:       string;
}

export interface NewRequestFormProps {
  /** Pre-fill (profile phone, or values copied from a past request via "refaire"). */
  initialValues?: Partial<NewRequestValues>;
  isSubmitting?:  boolean;
  onSubmit:       (values: NewRequestValues) => void;
  onCancel:       () => void;
}


const SLOGAN_MAX     = 280;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;            // 2 MB
const LOGO_ACCEPT    = ["image/png", "image/svg+xml", "image/jpeg"];
const DEFAULT_PALETTE = ["#0E9E8C", "#34CBB7"];
const MA_PHONE = /^(?:\+212|0)\s?[5-7](?:[\s.-]?\d){8}$/;


export function NewRequestForm({
  initialValues, isSubmitting, onSubmit, onCancel,
}: NewRequestFormProps) {
  const [v, setV] = useState<NewRequestValues>({
    storeName:    "",
    slogan:       "",
    logoFile:     null,
    brand:        { palette: DEFAULT_PALETTE },
    phone:        "",
    customDomain: "",
    urgency:      "ce_mois",
    vision:       "",
    ...initialValues,
  });
  const [logoError, setLogoError] = useState<string | null>(null);

  const set = <K extends keyof NewRequestValues>(k: K, val: NewRequestValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const phoneValid = MA_PHONE.test(v.phone.trim());
  const canSubmit  = v.storeName.trim().length > 0 && phoneValid && !isSubmitting;

  const setColor    = (i: number, hex: string) =>
    set("brand", { palette: v.brand.palette.map((c, idx) => (idx === i ? hex : c)) });
  const addColor    = () => v.brand.palette.length < 3 &&
    set("brand", { palette: [...v.brand.palette, "#F59E0B"] });
  const removeColor = (i: number) =>
    v.brand.palette.length > 2 &&
    set("brand", { palette: v.brand.palette.filter((_, idx) => idx !== i) });

  const acceptLogo = (file: File | null) => {
    if (!file) {
      set("logoFile", null);
      setLogoError(null);
      return;
    }
    if (!LOGO_ACCEPT.includes(file.type)) {
      setLogoError("Format non supporté. Utilisez PNG, SVG ou JPG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError("Le fichier dépasse 2 Mo.");
      return;
    }
    setLogoError(null);
    set("logoFile", file);
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(v);
      }}
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Nouvelle demande de boutique
        </h1>
        <p className="text-sm text-muted-foreground">
          Décrivez votre boutique idéale. Nos développeurs s'occupent du reste.
        </p>
      </header>

      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <Field htmlFor="store-name" label="Nom de la boutique" required>
          <Input
            id="store-name"
            value={v.storeName}
            onChange={(e) => set("storeName", e.target.value)}
            placeholder="Pharmacie Centre"
            required
          />
        </Field>

        <Field htmlFor="store-slogan" label="Slogan / Description" hint={`${v.slogan.length}/${SLOGAN_MAX}`}>
          <Textarea
            id="store-slogan"
            value={v.slogan}
            maxLength={SLOGAN_MAX}
            onChange={(e) => set("slogan", e.target.value)}
            placeholder="Votre santé, notre priorité."
          />
        </Field>

        <Field label="Logo" hint="PNG, SVG ou JPG · 2 Mo max">
          <LogoDropzone file={v.logoFile} onFile={acceptLogo} />
          {logoError && (
            <p className="rounded-lg border border-error-border bg-error-subtle px-3 py-2 text-sm font-medium text-error-subtle-foreground">
              {logoError}
            </p>
          )}
        </Field>

        <Field label="2 à 3 couleurs de marque">
          <div className="flex flex-wrap items-center gap-3">
            {v.brand.palette.map((hex, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-subtle py-1 pl-1 pr-2"
              >
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="size-7 cursor-pointer rounded-md border-0 bg-transparent p-0"
                  aria-label={`Couleur ${i + 1}`}
                />
                <input
                  value={hex}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="w-20 bg-transparent font-mono text-xs tabular-nums text-foreground outline-none"
                />
                {v.brand.palette.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeColor(i)}
                    aria-label="Retirer la couleur"
                    className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {v.brand.palette.length < 3 && (
              <Button type="button" variant="outline" size="sm" onClick={addColor}>
                + Couleur
              </Button>
            )}
          </div>
        </Field>

        <Field
          htmlFor="store-phone"
          label="Numéro de téléphone"
          required
          hint={
            !phoneValid && v.phone
              ? "Format marocain attendu (ex : 06 12 34 56 78)"
              : "Le développeur vous contactera à ce numéro"
          }
        >
          <Input
            id="store-phone"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="06 12 34 56 78"
            inputMode="tel"
            aria-invalid={!!v.phone && !phoneValid}
            required
          />
        </Field>

        <Field htmlFor="store-domain" label="Domaine personnalisé" optional>
          <Input
            id="store-domain"
            value={v.customDomain}
            onChange={(e) => set("customDomain", e.target.value)}
            placeholder="ma-pharmacie.ma"
          />
        </Field>

        <Field label="Urgence">
          <div className="inline-flex gap-0.5 rounded-full border border-border bg-surface-subtle p-0.5">
            {(["asap", "ce_mois", "flexible"] as Urgency[]).map((u) => {
              const on = v.urgency === u;
              return (
                <button
                  key={u}
                  type="button"
                  data-on={on}
                  onClick={() => set("urgency", u)}
                  className="cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors data-[on=true]:bg-primary data-[on=true]:text-primary-foreground data-[on=true]:shadow-sm"
                >
                  {URGENCY_LABEL[u]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field htmlFor="store-vision" label="Vision libre">
          <Textarea
            id="store-vision"
            value={v.vision}
            onChange={(e) => set("vision", e.target.value)}
            rows={4}
            placeholder="Décrivez votre boutique idéale, vos inspirations, votre clientèle…"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2.5">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          Envoyer la demande
        </Button>
      </div>
    </form>
  );
}


// ── Helpers ────────────────────────────────────────────────────────────────

function Field({
  label, htmlFor, required, optional, hint, children,
}: {
  label:     string;
  htmlFor?:  string;
  required?: boolean;
  optional?: boolean;
  hint?:     ReactNode;
  children:  ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="flex items-center gap-1.5 text-foreground">
          <span>{label}</span>
          {required && <span className="text-error-subtle-foreground">*</span>}
          {optional && (
            <span className="text-xs font-normal text-muted-foreground">(optionnel)</span>
          )}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}


function LogoDropzone({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
      data-over={over}
      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-subtle px-4 py-8 text-center transition-colors hover:bg-surface-subtle/70 data-[over=true]:border-primary data-[over=true]:bg-surface-subtle"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground">
        <Upload className="size-5" />
      </span>
      {file ? (
        <span className="text-sm font-medium text-foreground">{file.name}</span>
      ) : (
        <>
          <span className="text-sm font-medium text-foreground">Glissez votre logo ici</span>
          <span className="text-xs text-muted-foreground">ou cliquez pour parcourir</span>
        </>
      )}
      <input
        type="file"
        accept=".png,.svg,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
