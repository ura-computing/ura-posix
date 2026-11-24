/** Ask for the online store, one question per screen (like « Créer un compte »): the store's name → its logo →
 *  the WhatsApp number customers will write to → its colors → domain → wishes, then « Envoyer ».
 *  Also « Modifier » while the request is « Envoyée » (`initial`: the request; the logo is then optional). */
import { useState, type FormEvent } from "react";

import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";
import { Textarea } from "@/_components/atoms/Input";
import { ColorField } from "@/_components/molecules/ColorField";
import { FileDropZone } from "@/_components/molecules/FileDropZone";
import { FormField } from "@/_components/molecules/FormField";
import { PhoneField } from "@/_components/molecules/PhoneField";
import { TextField } from "@/_components/molecules/TextField";
import { Thumbnail } from "@/_components/molecules/Thumbnail";
import { WizardProgress } from "@/_components/molecules/WizardProgress";
import { apiUrl } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
import type { WebsiteRequestCreate, WebsiteRequestOut } from "@/types/storeWebsite";
import { Store } from "lucide-react";

type Step = "name" | "logo" | "whatsapp" | "colors" | "domain" | "wishes";
const STEPS: Step[] = ["name", "logo", "whatsapp", "colors", "domain", "wishes"];
const COLOR_LABEL = ["store.colorPrimary", "store.colorSecondary", "store.colorAccent"];
const LOGO_TYPES = "image/png,image/jpeg,image/svg+xml,image/webp";
const LOGO_MAX = 2 * 1024 * 1024;

export function RequestWizard({
  initial,
  isSending,
  onSubmit,
  onCancel,
}: {
  initial: WebsiteRequestOut | null;
  isSending: boolean;
  onSubmit: (body: WebsiteRequestCreate, logo: File | null) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState<Step>("name");
  const [error, setError] = useState<string | null>(null);
  const [storeName, setStoreName] = useState(initial?.store_name ?? "");
  const [slogan, setSlogan] = useState(initial?.slogan ?? "");
  const [logo, setLogo] = useState<{ file: File; url: string } | null>(null);
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [colors, setColors] = useState<string[]>(initial?.brand_palette ?? ["#0E9E8C", "#F4C9D9", "#E9C887"]);
  const [domain, setDomain] = useState(initial?.custom_domain ?? "");
  const [vision, setVision] = useState(initial?.vision ?? "");

  const index = STEPS.indexOf(step);
  const isLast = index === STEPS.length - 1;
  const currentLogo = logo?.url ?? (initial?.logo_url ? apiUrl(initial.logo_url) : null);

  /** What blocks « Suivant » on this screen (null = it can go on). */
  const problem = (): string | null => {
    if (step === "name" && !storeName.trim()) return t("myStore.nameRequired");
    if (step === "logo" && !currentLogo) return t("myStore.logoRequired");
    if (step === "whatsapp" && phone.replace(/\D/g, "").length < 9) return t("myStore.whatsappRequired");
    return null;
  };

  const pickLogo = (file: File) => {
    if (!LOGO_TYPES.split(",").includes(file.type)) return setError(t("errors.logoFormat"));
    if (file.size > LOGO_MAX) return setError(t("errors.logoTooLarge"));
    if (logo) URL.revokeObjectURL(logo.url);
    setError(null);
    setLogo({ file, url: URL.createObjectURL(file) });
  };

  const next = async (e: FormEvent) => {
    e.preventDefault();
    const blocked = problem();
    if (blocked) return setError(blocked);
    setError(null);
    if (!isLast) return setStep(STEPS[index + 1]);
    await onSubmit(
      {
        store_name: storeName.trim(),
        slogan: slogan.trim() || null,
        brand_palette: colors,
        phone,
        custom_domain: domain.trim() || null,
        vision: vision.trim() || null,
      },
      logo?.file ?? null,
    );
  };

  return (
    <Card className="flex flex-col gap-6">
      <form className="flex flex-col gap-6" onSubmit={(e) => void next(e)} noValidate>
        <WizardProgress label={t("myStore.wizardLabel")} total={STEPS.length} current={index} />
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t(`myStore.${step}Title`)}</h2>
          <p className="text-sm text-muted-foreground">{t(`myStore.${step}Desc`)}</p>
        </header>

        {step === "name" && (
          <div className="flex flex-col gap-4">
            <TextField
              label={t("myStore.storeName")}
              placeholder={t("myStore.storeNamePlaceholder")}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              error={error ?? undefined}
              maxLength={120}
              autoFocus
            />
            <TextField
              label={t("myStore.slogan")}
              hint={t("common.optional")}
              placeholder={t("myStore.sloganPlaceholder")}
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              maxLength={280}
            />
          </div>
        )}

        {step === "logo" && (
          <FileDropZone
            title={currentLogo ? t("store.replaceLogo") : t("store.addLogo")}
            hint={t("store.logoHint")}
            accept={LOGO_TYPES}
            onFiles={([file]) => pickLogo(file)}
            preview={
              currentLogo ? (
                <Thumbnail
                  key={currentLogo}
                  src={currentLogo}
                  alt={storeName}
                  icon={Store}
                  label={t("store.noLogo")}
                  className="size-24 rounded-xl p-2"
                />
              ) : undefined
            }
          />
        )}

        {step === "whatsapp" && (
          <PhoneField
            label={t("myStore.whatsapp")}
            hint={t("myStore.whatsappHint")}
            value={phone}
            onChange={setPhone}
            error={error ?? undefined}
          />
        )}

        {step === "colors" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {colors.map((c, i) => (
              <ColorField
                key={COLOR_LABEL[i]}
                label={t(COLOR_LABEL[i])}
                value={c}
                onChange={(hex) => setColors(colors.map((old, j) => (j === i ? hex : old)))}
              />
            ))}
          </div>
        )}

        {step === "domain" && (
          <TextField
            label={t("myStore.domain")}
            hint={t("myStore.domainHint")}
            placeholder="pharmacie-exemple.ma"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            maxLength={255}
          />
        )}

        {step === "wishes" && (
          <FormField label={t("myStore.wishes")} hint={t("common.optional")}>
            <Textarea
              rows={5}
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder={t("myStore.wishesPlaceholder")}
              maxLength={2000}
            />
          </FormField>
        )}

        {error && step !== "name" && step !== "whatsapp" && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          {index > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(STEPS[index - 1])}>
              {t("common.back")}
            </Button>
          ) : onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" className="min-w-32" isLoading={isSending} loadingText={t("myStore.sending")}>
            {isLast ? t(initial ? "common.save" : "myStore.send") : t("common.next")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
