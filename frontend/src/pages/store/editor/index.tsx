/** /admin/boutiques/:id/editeur — build a pharmacy's online store (staff, the person who took the request). Left:
 *  the settings (model, sections, colors, logo, fonts); right: the store as customers see it, reloaded after each
 *  save. « Enregistrement auto » on = saved 0,5 s after each change; off = « Enregistrer ». */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Download, RotateCcw, Save, Store } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button, ButtonLink } from "@/_components/atoms/Button";
import { Spinner } from "@/_components/atoms/Spinner";
import { BackLink } from "@/_components/molecules/BackLink";
import { Callout } from "@/_components/molecules/Callout";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { KebabItem, KebabMenu } from "@/_components/molecules/KebabMenu";
import { LoadError } from "@/_components/molecules/LoadError";
import { PageSkeleton } from "@/_components/molecules/Skeletons";
import { Thumbnail } from "@/_components/molecules/Thumbnail";
import { Page } from "@/_components/templates/Page";
import { apiUrl } from "@/api/client";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";

import { StateBadge } from "../_components/RequestBadges";
import { requestPath } from "../paths";
import { EditorSettings } from "./_components/EditorSettings";
import { StorePreview } from "./_components/StorePreview";
import { useStoreEditor } from "./hooks";

export default function StoreEditorPage() {
  const t = useT();
  const { id = "" } = useParams<{ id: string }>();
  const { me } = useMe();
  const {
    request,
    customization,
    isLoading,
    isError,
    reload,
    patch,
    save,
    hasUnsaved,
    isSaving,
    autoSave,
    setAutoSave,
    uploadLogo,
    isUploading,
    resetCustomization,
    isResetting,
  } = useStoreEditor(id);
  const [resetOpen, setResetOpen] = useState(false);

  const back = <BackLink to={requestPath(id)} label={t("store.backToRequest")} />;
  if (isLoading) return <PageSkeleton />;
  if (isError || !request || !customization) {
    return (
      <Page above={back} title={t("store.editorTitle")}>
        <LoadError message={t("store.requestLoadError")} onRetry={reload} />
      </Page>
    );
  }

  const isMine = !!request.claimed_by && String(request.claimed_by.id) === me?.id;
  if (!isMine) {
    return (
      <Page above={back} title={t("store.editorOf", { name: request.store_name })}>
        <Callout
          tone="info"
          title={t("store.editorNotMine")}
          action={
            <ButtonLink to={requestPath(id)} variant="outline">
              {t("store.backToRequest")}
            </ButtonLink>
          }
        >
          {t("store.editorNotMineHint")}
        </Callout>
      </Page>
    );
  }

  const logo = customization.logo_url ? apiUrl(customization.logo_url) : null;

  return (
    <Page
      above={back}
      media={
        <Thumbnail
          key={logo}
          src={logo}
          alt={request.store_name}
          icon={Store}
          label={t("store.noLogo")}
          className="size-16 rounded-xl p-1.5"
        />
      }
      title={request.store_name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {[request.pharmacy_name, request.pharmacy_code].filter(Boolean).join(" · ")}
          <StateBadge state={request.state} />
          {isSaving ? (
            <Badge>
              <Spinner size="sm" />
              {t("store.saving")}
            </Badge>
          ) : hasUnsaved ? (
            <Badge tone="warning">{t("store.unsaved")}</Badge>
          ) : (
            <Badge tone="success">
              <Check className="size-3" />
              {t("store.allSaved")}
            </Badge>
          )}
        </span>
      }
      actions={
        <>
          {/* No backend yet for the site's files: shown, greyed out, with the reason. */}
          <Button variant="outline" disabled title={t("store.downloadSoon")}>
            <Download className="size-4" />
            {t("store.download")}
          </Button>
          <Button variant={hasUnsaved ? "primary" : "outline"} disabled={!hasUnsaved || isSaving} onClick={save}>
            <Save className="size-4" />
            {t("common.save")}
          </Button>
          <KebabMenu label={t("store.moreActions")}>
            {(close) => (
              <KebabItem
                icon={<RotateCcw className="size-3.5" />}
                danger
                onSelect={() => setResetOpen(true)}
                close={close}
              >
                {t("store.reset")}
              </KebabItem>
            )}
          </KebabMenu>
        </>
      }
    >
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[380px_1fr]">
        <EditorSettings
          customization={customization}
          onPatch={patch}
          onLogo={(file) => void uploadLogo(file)}
          isUploading={isUploading}
          autoSave={autoSave}
          onAutoSave={setAutoSave}
        />
        <div className="xl:sticky xl:top-5">
          <StorePreview requestId={id} template={customization.template} version={request.customization.updated_at} />
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        variant="destructive"
        title={t("store.resetTitle")}
        description={t("store.resetDesc")}
        confirmLabel={t("store.reset")}
        isLoading={isResetting}
        onConfirm={async () => {
          await resetCustomization();
          setResetOpen(false);
        }}
      />
    </Page>
  );
}
