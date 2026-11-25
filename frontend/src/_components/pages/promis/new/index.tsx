/** « Nouveau promis », one question per screen: 1 the customer (known or new) → 2 the products + boxes (catalogue
 *  search with free stock, or a typed name) → 3 the summary → « Créer le promis ». */
import type { ReactNode } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";
import { Checkbox } from "@/_components/atoms/Checkbox";
import { Textarea } from "@/_components/atoms/Input";
import { BackLink } from "@/_components/molecules/BackLink";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { PhoneField } from "@/_components/molecules/PhoneField";
import { QuantityField } from "@/_components/molecules/QuantityField";
import { SearchField } from "@/_components/molecules/SearchField";
import { TabBar } from "@/_components/molecules/TabBar";
import { WizardProgress } from "@/_components/molecules/WizardProgress";
import { Page } from "@/_components/templates/Page";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import { formatMAD, formatNumStr } from "@/utils/format";

import { useNewPromis } from "./hooks";

const STEPS = ["promis.stepCustomer", "promis.stepProducts", "promis.stepSummary"];

function Tick({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-9 w-fit cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
      <Checkbox checked={checked} onChange={onChange} className="size-5" />
      {label}
    </label>
  );
}

export default function NewPromisPage() {
  const t = useT();
  const { me } = useMe();
  const {
    addLine,
    create,
    customer,
    customerTab,
    customers,
    customerSearch,
    isCreating,
    isSearchingProducts,
    lines,
    name,
    note,
    phone,
    products,
    productSearch,
    removeLine,
    setCustomer,
    setCustomerSearch,
    setCustomerTab,
    setName,
    setNote,
    setPhone,
    setProductSearch,
    setQuantity,
    setStep,
    setUnreachable,
    setWhatsappOk,
    step,
    typedPhone,
    unreachable,
    whatsappOk,
  } = useNewPromis();

  const known = customerTab === "known";
  const customerPhone = known ? (customer?.phone ?? null) : typedPhone;
  const phoneShort = !known && !!typedPhone && typedPhone.length < 11;
  // Why « Suivant » waits, written next to it.
  const missing = [
    known && !customer
      ? "promis.needKnownCustomer"
      : !known && !name.trim()
        ? "promis.needName"
        : phoneShort
          ? "promis.phoneError"
          : !customerPhone && !unreachable
            ? "promis.needContact"
            : null,
    lines.length === 0 ? "promis.needProduct" : lines.some((l) => !Number(l.quantity)) ? "promis.needQuantity" : null,
    null,
  ][step];

  const row = (title: string, children: ReactNode) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
  const typed = productSearch.trim();

  return (
    <Page narrow title={t("promis.new")} above={<BackLink to={`/${me?.role}/promis`} label={t("promis.backToList")} />}>
      <Card className="flex flex-col gap-6">
        <WizardProgress label={t("promis.new")} total={STEPS.length} current={step} />
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t(STEPS[step])}</h2>
          <p className="text-sm text-muted-foreground">{t(`${STEPS[step]}Desc`)}</p>
        </header>

        {step === 0 && (
          <>
            <TabBar
              tabs={[
                { id: "known", label: t("promis.knownCustomer") },
                { id: "new", label: t("promis.newCustomer") },
              ]}
              activeId={customerTab}
              onChange={setCustomerTab}
            />
            {known && (
              <>
                <SearchField
                  value={customerSearch}
                  onChange={setCustomerSearch}
                  placeholder={t("promis.searchCustomer")}
                  suggestions={null}
                  onPick={() => undefined}
                />
                {(customers.length > 0 || customer) && (
                  <div role="radiogroup" aria-label={t("promis.knownCustomer")} className="flex flex-col gap-2">
                    {(customer && !customers.some((c) => c.id === customer.id)
                      ? [customer, ...customers]
                      : customers
                    ).map((c) => (
                      <ChoiceCard
                        key={c.id}
                        selected={customer?.id === c.id}
                        onSelect={() => setCustomer(customer?.id === c.id ? null : c)}
                        className="gap-0.5 p-3"
                      >
                        <span className="text-sm font-semibold text-foreground">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.phone ?? "—"}</span>
                      </ChoiceCard>
                    ))}
                  </div>
                )}
                <Button variant="link" className="w-fit" onClick={() => setCustomerTab("new")}>
                  {t("promis.switchToNew")}
                </Button>
              </>
            )}
            {!known && (
              <>
                <FormField label={t("promis.customerName")}>
                  <FormInput value={name} onChange={setName} maxLength={120} />
                </FormField>
                <PhoneField
                  label={t("promis.phone")}
                  value={phone}
                  onChange={setPhone}
                  error={phoneShort ? t("promis.phoneError") : undefined}
                />
                {typedPhone && <Tick label={t("promis.whatsappOk")} checked={whatsappOk} onChange={setWhatsappOk} />}
                <Button variant="link" className="w-fit" onClick={() => setCustomerTab("known")}>
                  {t("promis.switchToKnown")}
                </Button>
              </>
            )}
            {(!known || customer) && !customerPhone && (
              <Tick label={t("promis.unreachable")} checked={unreachable} onChange={setUnreachable} />
            )}
          </>
        )}

        {step === 1 && (
          <>
            <SearchField
              value={productSearch}
              onChange={setProductSearch}
              placeholder={t("promis.searchProduct")}
              suggestions={null}
              onPick={() => undefined}
              isLoading={isSearchingProducts}
            />
            {typed.length >= 2 && !isSearchingProducts && (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                {products.map((p) => {
                  const added = lines.some((l) => l.medicament_id === p.id);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium text-foreground">{p.product}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.free_stock == null
                            ? t("promis.notInStock")
                            : t("promis.freeStock", { n: formatNumStr(p.free_stock) })}
                          {p.price != null && <> · {formatMAD(p.price)}</>}
                        </span>
                      </span>
                      <Button
                        variant="outline"
                        disabled={added}
                        onClick={() => addLine(p.id, p.product)}
                        aria-label={`${t("promis.addProduct")} ${p.product}`}
                      >
                        {added ? <Check className="size-4" /> : <Plus className="size-4" />}
                        {t("promis.addProduct")}
                      </Button>
                    </li>
                  );
                })}
                <li className="px-3 py-2">
                  <Button
                    variant="ghost"
                    disabled={lines.some((l) => l.medicament_id === null && l.name === typed)}
                    onClick={() => addLine(null, typed)}
                  >
                    <Plus className="size-4" />
                    {t("promis.addTyped", { name: typed })}
                  </Button>
                </li>
              </ul>
            )}
            {lines.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{t("promis.chosen")}</h3>
                {lines.map((l, i) => (
                  <div
                    key={l.medicament_id ?? l.name}
                    className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <span className="flex min-w-0 flex-col items-start gap-1 self-center">
                      <span className="text-sm font-medium text-foreground">{l.name}</span>
                      {l.medicament_id === null && <Badge>{t("promis.outsideCatalogue")}</Badge>}
                    </span>
                    <div className="flex items-end gap-2">
                      <QuantityField
                        label={t("promis.quantity")}
                        value={l.quantity}
                        onChange={(v) => setQuantity(i, v)}
                        min={1}
                        max={1000}
                        decreaseLabel={t("promis.less")}
                        increaseLabel={t("promis.more")}
                      />
                      <Button variant="ghost" onClick={() => removeLine(i)}>
                        <Trash2 className="size-4" />
                        {t("promis.remove")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            {row(
              t("promis.customer"),
              <>
                {customer?.name ?? name.trim()} · {customerPhone ?? t("promis.unreachable")}
              </>,
            )}
            {row(
              t("promis.products"),
              lines.map((l, i) => (
                <div key={i}>
                  {l.quantity} × {l.name}
                </div>
              )),
            )}
            <FormField label={t("promis.note")}>
              <Textarea
                rows={2}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("promis.notePlaceholder")}
              />
            </FormField>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isCreating}>
              {t("common.back")}
            </Button>
          ) : (
            <span />
          )}
          <span className="flex flex-wrap items-center justify-end gap-3">
            {missing && <span className="text-sm text-muted-foreground">{t(missing)}</span>}
            {step < 2 ? (
              <Button size="lg" className="min-w-32" onClick={() => setStep(step + 1)} disabled={!!missing}>
                {t("common.next")}
              </Button>
            ) : (
              <Button
                size="lg"
                className="min-w-32"
                onClick={create}
                isLoading={isCreating}
                loadingText={t("common.saving")}
              >
                {t("promis.create")}
              </Button>
            )}
          </span>
        </div>
      </Card>
    </Page>
  );
}
