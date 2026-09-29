/** Section A of the pharmacy detail page — pharmacy-level feature toggles.
 *
 *  BATCHED SAVE (per locked decision): the parent holds two states — the
 *  server's current value (`enabledFeatures`) and the pending edits
 *  (`pendingValues`). This component just renders the toggles + the dirty
 *  action bar. Single bulk PUT fires on Enregistrer.
 *
 *  Drops the handoff's per-toggle pendingKey/saveState — those belonged to
 *  the original optimistic-save plan we overrode.
 */
import { Check, Loader2 } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { Switch } from "@/components/shared/Switch";
import { cn } from "@/utils/cn";

import { FEATURES, type FeatureKey } from "@/components/shared/members/constants";


export interface FeatureToggleGridProps {
  /** Pending values — what the user has currently set in the dialog. */
  values:        Record<FeatureKey, boolean>;
  /** Server's current state — used to compute dirty-count. */
  serverValues:  Record<FeatureKey, boolean>;
  isSaving?:     boolean;
  onToggle:      (key: FeatureKey, next: boolean) => void;
  onEnableAll:   () => void;
  onDisableAll:  () => void;
  onSave:        () => void;
  onCancel:      () => void;
}


export function FeatureToggleGrid({
  values, serverValues, isSaving, onToggle, onEnableAll, onDisableAll, onSave, onCancel,
}: FeatureToggleGridProps) {
  const t = useT();
  const enabledCount = FEATURES.filter((f) => values[f.key]).length;
  const dirtyCount   = FEATURES.filter((f) => values[f.key] !== serverValues[f.key]).length;
  const isDirty      = dirtyCount > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex max-w-[620px] flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{t("adminPharm.pharmacyFeaturesTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("adminPharm.pharmacyFeaturesDesc")}
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {enabledCount} / 9 {t("adminPharm.activatedFem")}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const on    = values[f.key];
            const dirty = on !== serverValues[f.key];
            const Icon  = f.icon;
            return (
              <div
                key={f.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors",
                  dirty && "border-primary/40 bg-primary/5",
                )}
              >
                <span
                  data-on={on}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground data-[on=true]:bg-primary/15 data-[on=true]:text-primary"
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">{t(f.label)}</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">{t(f.description)}</span>
                </div>
                <Switch checked={on} onChange={(next) => onToggle(f.key, next)} />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
          <AsyncButton variant="ghost" onClick={onEnableAll} className="!h-8 !px-2 text-xs">
            <Check className="size-3.5" />
            {t("adminPharm.enableAll")}
          </AsyncButton>
          <AsyncButton variant="ghost" onClick={onDisableAll} className="!h-8 !px-2 text-xs">
            {t("adminPharm.disableAll")}
          </AsyncButton>
        </div>
      </div>

      {/* Dirty action bar — appears only when at least one toggle differs from the server. */}
      {isDirty && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-primary/30 bg-primary/10 px-5 py-3">
          <span className="text-sm font-semibold text-primary">
            {dirtyCount} {t(dirtyCount > 1 ? "adminPharm.unsavedChangesPlural" : "adminPharm.unsavedChangesSingular")}
          </span>
          <div className="flex items-center gap-2">
            <AsyncButton variant="ghost" onClick={onCancel} disabled={isSaving}>
              {t("common.cancel")}
            </AsyncButton>
            <AsyncButton variant="primary" onClick={onSave} disabled={isSaving}>
              {isSaving && <Loader2 className="size-3.5 animate-spin" />}
              {t("common.save")}
            </AsyncButton>
          </div>
        </div>
      )}
    </section>
  );
}
