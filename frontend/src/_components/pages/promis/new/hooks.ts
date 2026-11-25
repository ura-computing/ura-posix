/** « Nouveau promis »: the form's answers (customer → products → summary), the two searches, « Créer le promis ». */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { API, refresh } from "@/api/api";
import { api } from "@/api/client";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { Customer, Promis, PromisInput, PromisProduct } from "@/types/promis";

export interface DraftLine {
  medicament_id: number | null;
  name: string;
  /** The text of the quantity field. */
  quantity: string;
  /** PPV and « Remise comptoir » (%) of a catalogue product (null / 0 outside the catalogue). */
  price: number | null;
  discount: number;
}

export function useNewPromis() {
  const t = useT();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { me } = useMe();
  const [step, setStep] = useState(0);
  const [customerTab, setCustomerTab] = useState<"known" | "new">("known");
  const [customer, setCustomer] = useState<Customer | null>(null); // the known one picked
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappOk, setWhatsappOk] = useState(true);
  const [unreachable, setUnreachable] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const { data: customers } = useQuery({
    queryKey: API.promis.customers.key(customerSearch),
    queryFn: () => api.get<Customer[]>(API.promis.customers.url, { params: { search: customerSearch } }),
    enabled: customerSearch.trim().length >= 2,
  });
  const { data: products, isFetching: isSearchingProducts } = useQuery({
    queryKey: API.promis.products.key(productSearch),
    queryFn: () => api.get<PromisProduct[]>(API.promis.products.url, { params: { search: productSearch } }),
    enabled: productSearch.trim().length >= 2,
  });

  const { mutate, isPending: isCreating } = useMutation({
    mutationFn: (body: PromisInput) => api.post<Promis>(API.promis.create.url, body),
    onSuccess: (promis) => {
      toast.success(t("promis.created", { n: promis.number }));
      void refresh(qc, API.promis.create);
      void navigate(`/${me?.role}/promis`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // « +212 » alone = nothing typed (the field always holds the country code).
  const typedPhone = phone.length > 4 ? phone : null;

  return {
    step,
    setStep,
    customerTab,
    // « Nouveau client »: the picked known one is let go.
    setCustomerTab: (tab: "known" | "new") => {
      setCustomerTab(tab);
      if (tab === "new") setCustomer(null);
    },
    customer,
    setCustomer,
    name,
    setName,
    phone,
    setPhone,
    typedPhone,
    whatsappOk,
    setWhatsappOk,
    unreachable,
    setUnreachable,
    lines,
    addLine: (medicament_id: number | null, lineName: string, price: number | null = null, discount = 0) =>
      setLines((all) => [...all, { medicament_id, name: lineName, quantity: "1", price, discount }]),
    setQuantity: (index: number, quantity: string) =>
      setLines((all) => all.map((l, i) => (i === index ? { ...l, quantity } : l))),
    removeLine: (index: number) => setLines((all) => all.filter((_, i) => i !== index)),
    note,
    setNote,
    customerSearch,
    setCustomerSearch,
    customers: customerSearch.trim().length >= 2 ? (customers ?? []) : [],
    productSearch,
    setProductSearch,
    products: productSearch.trim().length >= 2 ? (products ?? []) : [],
    isSearchingProducts,
    create: () =>
      mutate({
        customer_id: customer?.id ?? null,
        customer: customer ? null : { name: name.trim(), phone: typedPhone, whatsapp_ok: whatsappOk },
        unreachable,
        note: note.trim() || null,
        lines: lines.map(({ medicament_id, name, quantity }) => ({ medicament_id, name, quantity: Number(quantity) })),
      }),
    isCreating,
  };
}
