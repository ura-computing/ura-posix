/** Route container for /store-website/new (owner). Mocked-data version
 *  toasts on submit and bounces back to /store-website. */
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { NewRequestForm, type NewRequestValues } from "./_components/NewRequestForm";


export default function StoreWebsiteNewRoute() {
  const navigate = useNavigate();

  const handleSubmit = (_values: NewRequestValues) => {
    toast.success("Demande envoyée — votre développeur vous contactera bientôt.");
    navigate("/store-website");
  };

  return (
    <NewRequestForm
      initialValues={{ phone: "0600000001" }}
      onSubmit={handleSubmit}
      onCancel={() => navigate("/store-website")}
    />
  );
}
