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
import { useEffect, useState } from "react";
import { Info, Check, Loader2, X } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { AsyncButton } from "./AsyncButton";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";
import { Dialog, DialogContent } from "./dialog";
import { cn } from "@/utils/cn";
import type { MemberOut } from "@/types";

import { FEATURES, ROLE_LABEL, type FeatureKey } from "./memberConstants";


/** One layer that gates the user's effective access for each feature.
 *  The label appears on per-row pills; the values dict says which features
 *  this layer allows. A feature is "locked" when ANY ceiling layer has it
 *  set to false. */
export interface CeilingLayer {
  label:  string;                              // "Pharmacie" | "Vous" | …
  values: Record<FeatureKey, boolean>;
}


export interface UserPermissionsDialogProps {
  open:             boolean;
  onClose:          () => void;
  user:             MemberOut | null;
  /** Sentence inserted into the info banner — should mention the ceiling
   *  layers (e.g. "Une permission n'est effective que si la pharmacie ET
   *  vous-même l'avez activée."). Keeps copy ownership with the caller. */
  contextStrip:     React.ReactNode;
  /** Ordered list of ceiling layers — at least one. Each contributes a pill
   *  on every feature row. */
  ceilings:         CeilingLayer[];
  /** UserPermission values (server-side current state) — used for dirty-bag. */
  serverPermissions: Record<FeatureKey, boolean>;
  isSaving?:        boolean;
  onSave:           (next: Record<FeatureKey, boolean>) => void;
}


const PILL_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";


export function UserPermissionsDialog({
  open, onClose, user, contextStrip, ceilings, serverPermissions, isSaving, onSave,
}: UserPermissionsDialogProps) {
  const t = useT();
  // Local pending edits — initialized from server, reset on open / user change.
  const [pending, setPending] = useState<Record<FeatureKey, boolean>>(serverPermissions);
  useEffect(() => {
    if (open) setPending(serverPermissions);
  }, [open, serverPermissions, user?.id]);

  if (!user) return null;

  const initials = (user.full_name ?? user.email).split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

  const set = (key: FeatureKey, next: boolean) =>
    setPending((prev) => ({ ...prev, [key]: next }));

  /** A feature is locked when ANY ceiling layer disallows it. */
  const isLocked = (key: FeatureKey) =>
    ceilings.some((layer) => !layer.values[key]);

  const enableAllPossible = () => {
    const next: Record<FeatureKey, boolean> = { ...pending };
    for (const f of FEATURES) {
      if (!isLocked(f.key)) next[f.key] = true;
    }
    setPending(next);
  };

  const isDirty = FEATURES.some((f) => pending[f.key] !== serverPermissions[f.key]);

  /** Tooltip text on a locked toggle — names the FIRST blocking layer. */
  const lockReason = (key: FeatureKey): string => {
    const blocker = ceilings.find((layer) => !layer.values[key]);
    if (!blocker) return "";
    return t("adminPharm.lockReason", { layer: blocker.label });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100vh-140px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-[15px] font-bold text-foreground">
              {initials}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[17px] font-semibold text-foreground">{user.full_name ?? user.email}</h3>
                <span className={cn(PILL_BASE, "bg-muted text-muted-foreground")}>{t(ROLE_LABEL[user.role])}</span>
              </div>
              <span className="text-[12.5px] text-muted-foreground">{user.email}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Context strip (caller-owned copy) */}
        <div className="mx-5 mt-3.5 flex items-start gap-2.5 rounded-lg border border-info-border bg-info-subtle px-3 py-2.5 text-info-subtle-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span className="text-[12.5px] leading-snug">{contextStrip}</span>
        </div>

        {/* Permission grid */}
        <div className="flex-1 overflow-auto p-5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const locked = isLocked(f.key);
              const userOn = !locked && pending[f.key];
              const Icon   = f.icon;

              const toggle = (
                <Switch checked={!!userOn} disabled={locked} onChange={(next) => set(f.key, next)} />
              );

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
                        <span
                          key={layer.label}
                          className={cn(PILL_BASE, allowed ? "bg-info-subtle text-info" : "bg-muted text-muted-foreground")}
                        >
                          {layer.label} : {allowed ? t("adminPharm.enabledF") : t("adminPharm.disabledF")}
                        </span>
                      );
                    })}
                    <div className="ml-auto">
                      {locked ? (
                        <Tooltip label={lockReason(f.key)} placement="top">
                          <span>{toggle}</span>
                        </Tooltip>
                      ) : toggle}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
          <AsyncButton variant="ghost" onClick={enableAllPossible} className="!h-9 !px-3 text-xs">
            <Check className="size-3.5" />
            {t("adminPharm.enableAllPossible")}
          </AsyncButton>
          <div className="flex items-center gap-2.5">
            <AsyncButton variant="secondary" onClick={onClose} disabled={isSaving}>
              {t("common.cancel")}
            </AsyncButton>
            <AsyncButton variant="primary" onClick={() => onSave(pending)} disabled={isSaving || !isDirty}>
              {isSaving && <Loader2 className="size-3.5 animate-spin" />}
              {t("common.save")}
            </AsyncButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
