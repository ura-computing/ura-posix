/** /support/boutiques/:id — one pharmacy's online-store request (Support). Left: what the owner asked (pharmacy,
 *  owner + phone, colors, domain, wishes: `FieldList`). Right: the steps (`Stepper`); the action of the
 *  current step on top:
 *
 *    Soumise ─« Prendre en charge »→ Prise en charge ─« Commencer »→ En cours ─« Livrée »→ Livrée ─« Clôturer »→
 *
 *  Only the person who took it moves it forward, opens the editor or gives it back (« Libérer »). */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Check, Hand, Pencil, Phone, Undo2 } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { buttonClass } from "@/_components/atoms/buttonClass";
import { BackLink } from "@/_components/molecules/BackLink";
import { Callout } from "@/_components/molecules/Callout";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { FieldList } from "@/_components/molecules/FieldList";
import { LoadError } from "@/_components/molecules/LoadError";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { PageSkeleton } from "@/_components/molecules/Skeletons";
import { Stepper } from "@/_components/molecules/Stepper";
import { Page } from "@/_components/templates/Page";
import { useT } from "@/i18n/I18nProvider";

import { REQUEST_STATE_LABEL, REQUEST_STATE_ORDER, type RequestState } from "@/types/storeWebsite";
import { formatDateTime } from "@/utils/format";

import { PaletteSwatches } from "@/_components/organisms/StoreRequestBadges";
import { BriefDialog } from "./_components/BriefDialog";
import { useEditBrief, useRequestActions, useStoreRequest } from "./hooks";

/** The next step and its button, for the person who took the request. */
const NEXT: Partial<Record<RequestState, { to: RequestState; label: string }>> = {
  prise_en_charge: { to: "en_cours", label: "store.start" },
  en_cours: { to: "livree", label: "store.markDelivered" },
  livree: { to: "cloturee", label: "store.close" },
};

export default function StoreRequestPage() {
  const t = useT();
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const { request, isMine, isLoading, isError, reload } = useStoreRequest(id);
  const { claimRequest, releaseRequest, moveRequestTo, isBusy } = useRequestActions(id);
  const [confirm, setConfirm] = useState<"release" | "close" | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const { editBrief, isEditingBrief } = useEditBrief(id);

  const back = <BackLink to={`/support/boutiques`} label={t("store.backToRequests")} />;
  if (isLoading) return <PageSkeleton />;
  if (isError || !request) {
    return (
      <Page above={back} title={t("store.requestsTitle")}>
        <LoadError message={t("store.requestLoadError")} onRetry={reload} />
      </Page>
    );
  }

  const next = isMine ? NEXT[request.state] : undefined;
  const free = !request.claimed_by;
  const canRelease = isMine && (request.state === "prise_en_charge" || request.state === "en_cours");
  const phone = request.phone.replace(/\s/g, "");

  return (
    <Page
      above={back}
      title={request.store_name}
      subtitle={request.slogan || undefined}
      actions={
        free ? (
          <Button size="lg" disabled={isBusy} onClick={() => void claimRequest()}>
            <Hand className="size-4" />
            {t("store.claim")}
          </Button>
        ) : isMine ? (
          <>
            <Button variant="outline" onClick={() => setBriefOpen(true)}>
              <Pencil className="size-4" />
              {t("store.editBrief")}
            </Button>
            {canRelease && (
              <Button variant="outline" disabled={isBusy} onClick={() => setConfirm("release")}>
                <Undo2 className="size-4" />
                {t("store.release")}
              </Button>
            )}
            {next && (
              <Button
                variant="outline"
                disabled={isBusy}
                onClick={() => (next.to === "cloturee" ? setConfirm("close") : void moveRequestTo(next.to))}
              >
                <Check className="size-4" />
                {t(next.label)}
              </Button>
            )}
            <Button size="lg" onClick={() => navigate(`/support/boutiques/${id}/editeur`)}>
              {t("store.openEditor")}
              <ArrowRight className="size-4" />
            </Button>
          </>
        ) : undefined
      }
    >
      {!free && !isMine && (
        <Callout tone="info" title={t("store.followedBy", { name: request.claimed_by?.name ?? "—" })}>
          {t("store.followedByHint")}
        </Callout>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <SectionCard
          title={t("store.theRequest")}
          actions={
            <a href={`tel:${phone}`} className={buttonClass("outline", "sm")}>
              <Phone className="size-3.5" />
              {t("store.call", { name: request.owner_name })}
            </a>
          }
        >
          <FieldList
            fields={[
              {
                label: t("store.colPharmacy"),
                value: [request.pharmacy_name, request.pharmacy_code].filter(Boolean).join(" · "),
              },
              { label: t("store.owner"), value: request.owner_name },
              { label: t("store.phone"), value: <span className="font-mono">{request.phone}</span> },
              { label: t("store.colAskedOn"), value: formatDateTime(request.created_at) },
              { label: t("store.colors"), value: <PaletteSwatches colors={request.brand_palette} /> },
              {
                label: t("store.domain"),
                value: <span className="font-mono">{request.custom_domain || t("store.noDomain")}</span>,
              },
              {
                label: t("store.wishes"),
                value: <span className="whitespace-pre-line">{request.vision || t("store.noWishes")}</span>,
              },
            ]}
          />
        </SectionCard>

        <SectionCard title={t("store.steps")}>
          <Stepper
            vertical
            steps={REQUEST_STATE_ORDER.map((s) => t(REQUEST_STATE_LABEL[s]))}
            current={REQUEST_STATE_ORDER.indexOf(request.state)}
          />
        </SectionCard>
      </div>

      {briefOpen && (
        <BriefDialog
          request={request}
          isSaving={isEditingBrief}
          onClose={() => setBriefOpen(false)}
          onSave={editBrief}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        variant={confirm === "release" ? "destructive" : "default"}
        title={t(confirm === "release" ? "store.releaseTitle" : "store.closeTitle")}
        description={t(confirm === "release" ? "store.releaseDesc" : "store.closeDesc")}
        confirmLabel={t(confirm === "release" ? "store.release" : "store.close")}
        onConfirm={async () => {
          if (confirm === "release") await releaseRequest();
          else await moveRequestTo("cloturee");
          setConfirm(null);
        }}
      />
    </Page>
  );
}
