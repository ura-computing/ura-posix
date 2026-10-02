/** Route container for /store-website/new (owner).
 *
 *  POSTs the form values to /v1/store-website/requests; on success, bounces
 *  back to /store-website which then shows the timeline of the new request.
 *  409 (an active request already exists) surfaces as an inline error inside
 *  the form. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT } from "@/i18n/I18nProvider";

import { ApiErr } from "@/api/client";
import { useMe } from "@/hooks/useMe";
import { NewRequestForm, type NewRequestValues } from "./_components/NewRequestForm";
import { useMyRequest } from "./_hooks/useMyRequest";


export default function StoreWebsiteNewRoute() {
  const navigate = useNavigate();
  const { me } = useMe();
  const t = useT();
  const { createRequest, isCreating } = useMyRequest();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: NewRequestValues) => {
    setError(null);
    try {
      await createRequest({
        store_name:    values.storeName,
        slogan:        values.slogan.trim() || null,
        brand_palette: values.brand.palette,
        phone:         values.phone,
        custom_domain: values.customDomain.trim() || null,
        urgency:       values.urgency,
        vision:        values.vision.trim() || null,
      });
      // Logo upload is deferred: only the DEV uploads the logo (via the
      // editor's logo box). Owners can add one later if we open that surface.
      toast.success(t("store.requestSent"));
      navigate("/store-website");
    } catch (e) {
      if (e instanceof ApiErr) setError(e.detail);
      else setError(t("toast.genericError"));
    }
  };

  return (
    <NewRequestForm
      initialValues={{ phone: me?.phone ?? "" }}
      isSubmitting={isCreating}
      submitError={error}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/store-website")}
    />
  );
}
