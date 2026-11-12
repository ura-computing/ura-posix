/** « Connexion Sobrus » (owner): PharmaGest imports the Sobrus achats + ventes + stock by itself.
 *  Not connected → email + password + consent. Connected → a status card, then « Importer depuis Sobrus »: the
 *  product page's toolbar (dates + 30 j · 90 j · Année en cours · 12 mois · Tout l'historique; cut into years by the
 *  robot, years « Déjà importé » skipped unless « Réimporter quand même »); the last days come every night.
 *  The run in progress step by step (connexion, téléchargement Ventes 2026
 *  3,4 Mo, import paquet 12 / 69…, « Arrêter »), the last runs. Password refused / Sobrus asks a
 *  check → a red card with « Mettre à jour le mot de passe ». The password is never shown again. */
import { useState } from "react";
import { Check, CheckCircle2, CircleAlert, Unplug } from "lucide-react";

import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Segmented } from "@/_components/molecules/Segmented";
import { Checkbox } from "@/_components/atoms/Checkbox";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { DateRangePicker } from "@/_components/molecules/DateRangePicker";
import { LoadError } from "@/_components/molecules/LoadError";
import { SkeletonCard } from "@/_components/molecules/Skeletons";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { PasswordInput } from "@/_components/molecules/PasswordField";
import { Page } from "@/_components/templates/Page";
import { Skeleton } from "@/_components/atoms/Skeleton";
import { Spinner } from "@/_components/atoms/Spinner";
import { Card } from "@/_components/atoms/Card";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { useT } from "@/i18n/I18nProvider";
import type { SobrusConnection, SobrusConnectionBody, SobrusRun, SobrusRunBody } from "@/types";
import { cn } from "@/utils/cn";
import { PERIOD_LABELS, PERIOD_PRESETS, presetOf, type PeriodPreset } from "@/utils/dateRange";
import { formatDateTime, formatNumStr } from "@/utils/format";
import { currentStep, eventText, modeName, runResult } from "@/utils/sobrus";

import { useSobrusPage } from "./hooks";

const CHOICE_ACTIVE = "bg-primary text-primary-foreground shadow-sm";

/** A run's result as a badge: done = green, stopped by Sobrus = red, stopped by the user = grey. */
const RUN_TONE: Partial<Record<SobrusRun["status"], BadgeTone>> = {
  success: "success",
  error: "error",
  cancelled: "neutral",
};

function ConnectForm({
  email: knownEmail,
  locked,
  update,
  isSaving,
  onSave,
}: {
  /** The saved email (update), the pharmacy's Sobrus account (reconnection) or empty (first connection). */
  email: string;
  /** The pharmacy's Sobrus account is set: only that email (the admin can change it). */
  locked: boolean;
  update: boolean;
  isSaving: boolean;
  onSave: (body: SobrusConnectionBody) => Promise<unknown>;
}) {
  const t = useT();
  const [email, setEmail] = useState(knownEmail);
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const ready = email.trim() !== "" && password !== "" && (update || consent);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready)
          void onSave({ email: email.trim(), password, consent: update || consent }).then(() => setPassword(""));
      }}
    >
      <FormField label={t("sobrus.email")} required hint={locked ? t("sobrus.emailLocked") : undefined}>
        <FormInput value={email} onChange={setEmail} type="email" autoComplete="off" readOnly={locked} />
      </FormField>
      <FormField
        label={update ? t("sobrus.newPassword") : t("sobrus.password")}
        required
        hint={t("sobrus.passwordHint")}
      >
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </FormField>
      {!update && (
        <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
          <Checkbox checked={consent} onChange={setConsent} aria-label={t("sobrus.consent")} className="mt-0.5" />
          <span>{t("sobrus.consent")}</span>
        </label>
      )}
      <Button type="submit" size="lg" disabled={!ready || isSaving} className="self-start">
        {isSaving && <Spinner />}
        {update ? t("sobrus.updatePassword") : t("sobrus.connect")}
      </Button>
    </form>
  );
}

function RunProgress({ run, isCancelling, onCancel }: { run: SobrusRun; isCancelling: boolean; onCancel: () => void }) {
  const t = useT();
  const importing = run.phase === "import" && run.chunk_total > 0;
  const steps = [...run.events].reverse().slice(0, 12);
  return (
    <Card className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{modeName(t, run)}</h2>
        {run.mode !== "check" && (
          <Button variant="secondary" onClick={onCancel} disabled={isCancelling || run.cancel_requested}>
            {t("sobrus.stop")}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 text-base font-medium text-foreground">
        <Spinner size="lg" className="text-primary" />
        <span>{currentStep(t, run)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full bg-primary transition-all", !importing && "w-1/3 animate-pulse")}
          style={importing ? { width: `${Math.round((run.chunk_current / run.chunk_total) * 100)}%` } : undefined}
        />
      </div>
      {run.mode !== "check" && (
        <p className="text-sm text-muted-foreground">{t("sobrus.addedSoFar", { n: formatNumStr(run.lines_added) })}</p>
      )}
      {steps.length > 0 && (
        <ol className="flex flex-col gap-1.5 border-t border-border pt-3">
          {steps.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>{eventText(t, e)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function RunsList({
  runs,
  isLoading,
  isError,
  onRetry,
}: {
  runs: SobrusRun[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT();
  if (isLoading) return <SkeletonCard lines={3} />;
  if (isError) return <LoadError onRetry={onRetry} />;
  if (runs.length === 0) return null;
  return (
    <Card className="flex flex-col gap-2">
      <SectionTitle>{t("sobrus.lastRuns")}</SectionTitle>
      <ul className="flex flex-col divide-y divide-border">
        {runs.map((run) => (
          <li key={run.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-foreground">{modeName(t, run)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(run.created_at)}</span>
            </div>
            <Badge tone={RUN_TONE[run.status] ?? "info"}>{runResult(t, run)}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Connected({
  connection,
  activeRun,
  isStarting,
  onStart,
  onDisconnect,
}: {
  connection: SobrusConnection;
  activeRun: SobrusRun | null;
  isStarting: boolean;
  onStart: (body: SobrusRunBody) => void;
  onDisconnect: () => void;
}) {
  const t = useT();
  // « Période »: a preset (its dates), « Tout l'historique », or dates picked (custom).
  const [choice, setChoice] = useState<PeriodPreset | "full" | "custom">("year");
  const [from, setFrom] = useState<string | null>(PERIOD_PRESETS.year().from);
  const [to, setTo] = useState<string | null>(PERIOD_PRESETS.year().to);
  const [force, setForce] = useState(false);
  const blocked = connection.status !== "active" || !!activeRun || isStarting;
  const badPeriod = !!from && !!to && from > to;
  const ready = choice === "full" || (!!from && !!to && !badPeriod);
  const pick = (v: PeriodPreset | "full" | "custom") => {
    setChoice(v);
    if (v !== "full" && v !== "custom") {
      const p = PERIOD_PRESETS[v]();
      setFrom(p.from);
      setTo(p.to);
    }
  };
  // Past years already imported in full that this period covers: skipped unless « Réimporter quand même ».
  const doneYears = [...new Set(Object.values(connection.imported_years).flat())].sort();
  const thisYear = new Date().getFullYear();
  const covered = doneYears.filter(
    (y) => y < thisYear && (choice === "full" || (!!from && !!to && from <= `${y}-01-01` && `${y}-12-31` <= to)),
  );
  const importNow = () => {
    const again = force && covered.length > 0;
    if (choice === "full") onStart({ mode: "full", force: again });
    else if (from && to) onStart({ mode: "range", date_from: from, date_to: to, force: again });
  };
  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-subtle text-success">
            <CheckCircle2 className="size-5" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="break-all text-base font-semibold text-foreground">
              {t("sobrus.connectedAs", { email: connection.email ?? "" })}
            </span>
            <span className="text-sm text-muted-foreground">
              {connection.last_success_at
                ? t("sobrus.lastImport", { date: formatDateTime(connection.last_success_at) })
                : t("sobrus.neverImported")}
            </span>
            <span className="text-sm text-muted-foreground">{t("sobrus.nightly")}</span>
          </div>
        </div>
        <Button variant="secondary" onClick={onDisconnect}>
          <Unplug className="size-4" />
          {t("sobrus.disconnect")}
        </Button>
      </Card>

      <Card className="flex flex-col gap-4">
        <SectionTitle>{t("sobrus.importTitle")}</SectionTitle>
        {/* The product page's toolbar: the periods (+ « Tout l'historique »: no dates), then their dates. */}
        <div className="flex flex-wrap items-center gap-2.5 overflow-x-auto rounded-xl border border-border bg-surface-subtle p-3">
          <Segmented
            value={choice}
            onChange={pick}
            options={[
              ...PERIOD_LABELS.map(([value, label]) => ({ value, label: t(label), activeBg: CHOICE_ACTIVE })),
              { value: "full" as const, label: t("sobrus.choiceAll"), activeBg: CHOICE_ACTIVE },
            ]}
          />
          {choice !== "full" && (
            <DateRangePicker
              from={from}
              to={to}
              onChange={(start, end) => {
                setFrom(start);
                setTo(end);
                setChoice(presetOf(start, end) ?? "custom");
              }}
            />
          )}
        </div>
        {choice !== "full" && badPeriod && <p className="text-sm text-error">{t("sobrus.periodInvalid")}</p>}
        {doneYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("sobrus.alreadyIn")}</span>
            {doneYears.map((y) => (
              <Badge key={y} tone="success">
                <Check className="size-3.5" />
                {y}
              </Badge>
            ))}
          </div>
        )}
        {covered.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
            <Checkbox checked={force} onChange={setForce} aria-label={t("sobrus.forceReimport")} className="mt-0.5" />
            <span>{t("sobrus.forceReimportYears", { years: covered.join(", ") })}</span>
          </label>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-md text-sm text-muted-foreground">
            {choice === "full" ? t("sobrus.allHint") : t("sobrus.periodHint")}
          </p>
          <Button size="lg" onClick={importNow} disabled={blocked || !ready}>
            {t("sobrus.import")}
          </Button>
        </div>
      </Card>
    </>
  );
}

export default function SobrusPage() {
  const t = useT();
  const {
    connection,
    isLoading,
    isError,
    reload,
    activeRun,
    runs,
    runsLoading,
    runsError,
    reloadRuns,
    saveConnection,
    isSaving,
    disconnect,
    isDisconnecting,
    startRun,
    isStarting,
    cancelRun,
    isCancelling,
  } = useSobrusPage();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <Page title={t("sobrus.title")} subtitle={t("sobrus.subtitle")} narrow>
      <div className="flex flex-col gap-5">
        {isError && !connection ? (
          <LoadError onRetry={reload} />
        ) : isLoading || !connection ? (
          <Skeleton className="h-48 w-full" />
        ) : !connection.connected ? (
          <Card className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t("sobrus.intro")}</p>
            <ConnectForm
              key="connect"
              email={connection.locked_email ?? ""}
              locked={!!connection.locked_email}
              update={false}
              isSaving={isSaving}
              onSave={saveConnection}
            />
          </Card>
        ) : (
          <>
            {connection.status !== "active" && !activeRun && (
              <Card className="flex flex-col gap-4 border-error/30">
                <div className="flex items-start gap-3 text-error-subtle-foreground">
                  <CircleAlert className="mt-0.5 size-5 shrink-0 text-error" aria-hidden />
                  <span className="text-base font-semibold">
                    {connection.status === "invalid" ? t("sobrus.problemPassword") : t("sobrus.problemCheck")}
                  </span>
                </div>
                {/* Sobrus asked a check (« Confirmez votre numéro »…): once done on sobrus.com, the same
                    password works again — « Réessayer » logs in again, no typing. */}
                {connection.status === "needs_login" && (
                  <Button
                    size="lg"
                    className="self-start"
                    onClick={() => void startRun({ mode: "check" })}
                    isLoading={isStarting}
                  >
                    {t("common.retry")}
                  </Button>
                )}
                <ConnectForm
                  key={`update-${connection.last_error_code}`}
                  email={connection.email ?? ""}
                  locked
                  update
                  isSaving={isSaving}
                  onSave={saveConnection}
                />
              </Card>
            )}
            <Connected
              connection={connection}
              activeRun={activeRun}
              isStarting={isStarting}
              onStart={(body) => void startRun(body)}
              onDisconnect={() => setConfirmDisconnect(true)}
            />
            {activeRun && (
              <RunProgress run={activeRun} isCancelling={isCancelling} onCancel={() => void cancelRun(activeRun.id)} />
            )}
            <RunsList runs={runs} isLoading={runsLoading} isError={runsError} onRetry={reloadRuns} />
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={() => void disconnect().then(() => setConfirmDisconnect(false))}
        title={t("sobrus.disconnectTitle")}
        description={t("sobrus.disconnectDesc")}
        variant="destructive"
        confirmLabel={t("sobrus.disconnect")}
        cancelLabel={t("common.cancel")}
        isLoading={isDisconnecting}
      />
    </Page>
  );
}
