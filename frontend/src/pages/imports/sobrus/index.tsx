/** « Connexion Sobrus » (owner): PharmaGest imports the Sobrus achats + ventes + stock by itself.
 *  Not connected → email + password + consent. Connected → one « Importer » for « Tout l'historique »
 *  or « Choisir les dates » (début → fin, cut into years by the robot); the last days come every night.
 *  The run in progress step by step (connexion, téléchargement Ventes 2026
 *  3,4 Mo, import paquet 12 / 69…, « Arrêter »), the last runs. Password refused / Sobrus asks a
 *  check → a red card with « Mettre à jour le mot de passe ». The password is never shown again. */
import { useState } from "react";
import { CheckCircle2, CircleAlert, Unplug } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { CategorySegment } from "@/_components/CategorySegment";
import { Checkbox } from "@/_components/Checkbox";
import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { DateRangePopover } from "@/_components/filterBar";
import { FormField, FormInput } from "@/_components/FormField";
import { Page } from "@/_components/Page";
import { Skeleton } from "@/_components/Skeleton";
import { Spinner } from "@/_components/atoms/Spinner";
import { Card } from "@/_components/atoms/Card";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { useT } from "@/i18n/I18nProvider";
import type { SobrusConnection, SobrusConnectionBody, SobrusRun, SobrusRunBody } from "@/types";
import { cn } from "@/utils/cn";
import { todayIso } from "@/utils/dateRange";
import { formatDateTime, formatNumStr } from "@/utils/format";
import { currentStep, eventText, modeName, runResult } from "@/utils/sobrus";

import { useSobrusPage } from "./hooks";

const CARD = "flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm";

const CHOICE_ACTIVE = "bg-primary text-primary-foreground shadow-sm";

function ConnectForm({
  email: knownEmail,
  update,
  isSaving,
  onSave,
}: {
  /** The saved email (update) or empty (first connection). */
  email: string;
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
      <FormField label={t("sobrus.email")} required>
        <FormInput value={email} onChange={setEmail} type="email" autoComplete="off" disabled={update} />
      </FormField>
      <FormField
        label={update ? t("sobrus.newPassword") : t("sobrus.password")}
        required
        hint={t("sobrus.passwordHint")}
      >
        <FormInput value={password} onChange={setPassword} type="password" autoComplete="new-password" />
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
    <section className={CARD} aria-live="polite">
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
    </section>
  );
}

function RunsList({ runs }: { runs: SobrusRun[] }) {
  const t = useT();
  if (runs.length === 0) return null;
  return (
    <section className={CARD}>
      <SectionTitle>{t("sobrus.lastRuns")}</SectionTitle>
      <ul className="flex flex-col divide-y divide-border">
        {runs.map((run) => (
          <li key={run.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {formatDateTime(run.created_at)} · {modeName(t, run)}
            </span>
            <span
              className={cn(
                "font-medium",
                run.status === "success" && "text-success",
                run.status === "error" && "text-error",
                run.status !== "success" && run.status !== "error" && "text-foreground",
              )}
            >
              {runResult(t, run)}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
  const [choice, setChoice] = useState<"full" | "range">("full");
  const [from, setFrom] = useState<string | null>(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState<string | null>(todayIso());
  const blocked = connection.status !== "active" || !!activeRun || isStarting;
  const badPeriod = !!from && !!to && from > to;
  const ready = choice === "full" || (!!from && !!to && !badPeriod);
  const importNow = () => {
    if (choice === "full") onStart({ mode: "full" });
    else if (from && to) onStart({ mode: "range", date_from: from, date_to: to });
  };
  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold text-foreground">
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
        <Button variant="ghost" onClick={onDisconnect}>
          <Unplug className="size-4" />
          {t("sobrus.disconnect")}
        </Button>
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <h2 className="text-base font-semibold text-foreground">{t("sobrus.importTitle")}</h2>
        <CategorySegment
          value={choice}
          onChange={setChoice}
          options={[
            { value: "full", label: t("sobrus.choiceAll"), activeBg: CHOICE_ACTIVE },
            { value: "range", label: t("sobrus.choicePeriod"), activeBg: CHOICE_ACTIVE },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          {choice === "full" ? t("sobrus.allHint") : t("sobrus.periodHint")}
        </p>
        {choice === "range" && (
          <DateRangePopover
            from={from}
            to={to}
            onChange={(start, end) => {
              setFrom(start);
              setTo(end);
            }}
            className="self-start"
          />
        )}
        {choice === "range" && badPeriod && <p className="text-sm text-error">{t("sobrus.periodInvalid")}</p>}
        <Button size="lg" onClick={importNow} disabled={blocked || !ready} className="self-start">
          {t("sobrus.import")}
        </Button>
      </div>
    </section>
  );
}

export default function SobrusPage() {
  const t = useT();
  const {
    connection,
    isLoading,
    activeRun,
    runs,
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
        {isLoading || !connection ? (
          <Skeleton className="h-48 w-full" />
        ) : !connection.connected ? (
          <section className={CARD}>
            <p className="text-sm text-muted-foreground">{t("sobrus.intro")}</p>
            <ConnectForm key="connect" email="" update={false} isSaving={isSaving} onSave={saveConnection} />
          </section>
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
                <ConnectForm
                  key={`update-${connection.last_error_code}`}
                  email={connection.email ?? ""}
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
            <RunsList runs={runs} />
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
