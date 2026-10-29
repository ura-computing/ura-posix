/** Per-user permission toggles dialog — generalized to N ceiling layers.
 *
 *  Each ceiling layer (e.g. "Pharmacie", "Vous") contributes one pill per
 *  feature row showing whether THAT layer allows the feature. The toggle is
 *  disabled when ANY ceiling layer has the feature off — the row also goes
 *  into a "locked" visual state.
 *
 *  Used in two places:
 *    - Admin opens for OWNER → ceilings: [{ label: "Pharmacie", values: pharmacyFeatures }]
 *    - Owner opens for EMPLOYEE → ceilings: [{ label: "Pharmacie", values: pharmacyFeatures },
 *                                            { label: "Vous",     values: myPermissions }]
 *
 *  Backend persists whatever the user picks; effective access is computed at
 *  read time by the 3-layer intersection in permissions.py.
 */
import { useState } from "react";
import { Check } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Callout } from "@/_components/molecules/Callout";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { Switch } from "@/_components/atoms/Switch";
import { Tooltip } from "@/_components/atoms/Tooltip";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import type { MemberOut } from "@/types";

import { FEATURES, ROLE_LABEL, type FeatureKey } from "@/_components/organisms/memberConstants";

/** One layer that gates the user's effective access for each feature.
 *  The label appears on per-row pills; the values dict says which features
 *  this layer allows. A feature is "locked" when ANY ceiling layer has it
 *  set to false. */
export interface CeilingLayer {
  label: string; // "Pharmacie" | "Vous" | …
  values: Record<FeatureKey, boolean>;
}

export interface UserPermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  user: MemberOut | null;
  /** Sentence inserted into the info banner — should mention the ceiling
   *  layers (e.g. "Une permission n'est effective que si la pharmacie ET
   *  vous-même l'avez activée."). Keeps copy ownership with the caller. */
  contextStrip: React.ReactNode;
  /** Ordered list of ceiling layers — at least one. Each contributes a pill
   *  on every feature row. */
  ceilings: CeilingLayer[];
  /** UserPermission values (server-side current state) — used for dirty-bag. */
  serverPermissions: Record<FeatureKey, boolean>;
  isSaving?: boolean;
  onSave: (next: Record<FeatureKey, boolean>) => void;
}

/** Mounted only while open (one mount per user): the toggles start from the
 *  server values on every open, no reset effect needed. */
export function UserPermissionsDialog(props: UserPermissionsDialogProps) {
  if (!props.open || !props.user) return null;
  return <PermissionsBody key={props.user.id} {...props} user={props.user} />;
}

function PermissionsBody({
  open,
  onClose,
  user,
  contextStrip,
  ceilings,
  serverPermissions,
  isSaving,
  onSave,
}: UserPermissionsDialogProps & { user: MemberOut }) {
  const t = useT();
  // Local pending edits, saved with « Enregistrer ».
  const [pending, setPending] = useState<Record<FeatureKey, boolean>>(serverPermissions);

  const initials = (user.full_name ?? user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const set = (key: FeatureKey, next: boolean) => setPending((prev) => ({ ...prev, [key]: next }));

  /** A feature is locked when ANY ceiling layer disallows it. */
  const isLocked = (key: FeatureKey) => ceilings.some((layer) => !layer.values[key]);

  // An employee's dialog leaves out the owners-only accesses (« Connexion Sobrus »).
  const shown = FEATURES.filter((f) => !f.ownerOnly || user.role === "owner");

  const enableAllPossible = () => {
    const next: Record<FeatureKey, boolean> = { ...pending };
    for (const f of shown) {
      if (!isLocked(f.key)) next[f.key] = true;
    }
    setPending(next);
  };

  const isDirty = shown.some((f) => pending[f.key] !== serverPermissions[f.key]);

  /** Tooltip text on a locked toggle — names the FIRST blocking layer. */
  const lockReason = (key: FeatureKey): string => {
    const blocker = ceilings.find((layer) => !layer.values[key]);
    if (!blocker) return "";
    return t("adminPharm.lockReason", { layer: blocker.label });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flex max-h-[calc(100vh-140px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader
          media={
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] font-bold text-foreground">
              {initials}
            </span>
          }
          title={user.full_name ?? user.email}
          subtitle={user.email}
          onClose={onClose}
        >
          <Badge className="mt-1 w-fit">{t(ROLE_LABEL[user.role])}</Badge>
        </DialogHeader>

        <DialogBody>
          {/* Context strip (caller-owned copy) */}
          <Callout tone="info">{contextStrip}</Callout>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((f) => {
              const locked = isLocked(f.key);
              const userOn = !locked && pending[f.key];
              const Icon = f.icon;

              const toggle = <Switch checked={!!userOn} disabled={locked} onChange={(next) => set(f.key, next)} />;

              return (
                <div
                  key={f.key}
                  data-locked={locked}
                  className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 data-[locked=true]:border-dashed data-[locked=true]:bg-surface-subtle"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      data-locked={locked}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary data-[locked=true]:bg-muted data-[locked=true]:text-muted-foreground"
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="text-[13px] font-semibold text-foreground">{t(f.label)}</span>
                  </div>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">{t(f.description)}</span>

                  {/* Ceiling pills — one per layer. The toggle sits below
                      the pill row so the layout stays clean when N≥2. */}
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                    {ceilings.map((layer) => {
                      const allowed = layer.values[f.key];
                      return (
                        <Badge key={layer.label} tone={allowed ? "info" : "neutral"}>
                          {layer.label} : {allowed ? t("adminPharm.enabledF") : t("adminPharm.disabledF")}
                        </Badge>
                      );
                    })}
                    <div className="ml-auto">
                      {locked ? (
                        <Tooltip label={lockReason(f.key)} placement="top">
                          <span>{toggle}</span>
                        </Tooltip>
                      ) : (
                        toggle
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogBody>

        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={enableAllPossible}>
            <Check className="size-3.5" />
            {t("adminPharm.enableAllPossible")}
          </Button>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => onSave(pending)}
              disabled={!isDirty}
              isLoading={isSaving}
              loadingText={t("common.saving")}
            >
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
