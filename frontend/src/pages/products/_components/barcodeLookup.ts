import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api, ApiErr } from "@/api/client";
import { API } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";
import { ROUTES } from "@/types";

/** « Scanner / Rechercher un code barre »: a PID or barcode (typed, or a USB scanner = digits +
 *  Entrée) → that product's sheet. Resolves false when no product of the pharmacy has it, null
 *  when the search failed (error toast). */
export function useBarcodeLookup() {
  const t = useT();
  const navigate = useNavigate();
  const [isSearching, setSearching] = useState(false);
  const lookup = async (raw: string): Promise<boolean | null> => {
    const code = raw.trim();
    if (!code) return false;
    setSearching(true);
    try {
      // Called directly, not through the query cache: « no product » is an answer shown in the
      // dialog, not an error toast.
      const { id } = await api.get<{ id: number }>(API.products.lookup.url, { params: { code } });
      navigate(ROUTES.PRODUIT.replace(":id", String(id)));
      return true;
    } catch (e) {
      if (e instanceof ApiErr && e.status === 404) return false;
      toast.error(e instanceof ApiErr ? e.detail : t("toast.genericError"));
      return null;
    } finally {
      setSearching(false);
    }
  };
  return {
    lookup,
    isSearching,
  };
}
