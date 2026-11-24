/** Contact: the pharmacy's own address and phone, « Écrire sur WhatsApp », « Appeler », and the map. No form: the
 *  pharmacy answers on WhatsApp. */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MapPin, MessageCircle, Phone } from "lucide-react";

import { fadeUpVariants, staggerContainer } from "../templates/_shared/motion";
import { contactText, whatsappLink } from "../templates/_shared/storefront";
import type { PageProps } from "./model";
import { PageTitle, Shell } from "./Shell";

export function StoreContact(props: PageProps) {
  const { store, pharmacyPhone, customization } = props;
  const address = [store.summary?.address, store.summary?.city].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent([customization.storeName, address].filter(Boolean).join(", "));

  return (
    <Shell props={props}>
      <PageTitle
        eyebrow="Contact"
        title="Une question ? Écrivez-nous."
        sub="Disponibilité d'un produit, conseil, commande : la pharmacie vous répond sur WhatsApp."
      />
      <motion.div
        className="mx-auto grid max-w-[1200px] gap-5 px-5 py-12 sm:px-8 md:grid-cols-3 md:py-16"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <InfoCard icon={<MessageCircle className="size-5" />} title="WhatsApp">
          <a
            href={whatsappLink(pharmacyPhone, contactText)}
            target="_blank"
            rel="noopener noreferrer"
            className="sf-cta mt-2 w-fit text-[13px]"
          >
            Écrire maintenant
          </a>
        </InfoCard>
        <InfoCard icon={<Phone className="size-5" />} title="Téléphone">
          <a href={`tel:${pharmacyPhone}`} className="font-semibold hover:text-[var(--sf-primary)]">
            {pharmacyPhone}
          </a>
        </InfoCard>
        {address && (
          <InfoCard icon={<MapPin className="size-5" />} title="Adresse">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--sf-primary)]"
            >
              {address}
            </a>
          </InfoCard>
        )}
      </motion.div>
    </Shell>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <motion.div
      variants={fadeUpVariants}
      className="sf-card flex items-start gap-4 rounded-[var(--sf-radius)] border border-[var(--sf-line)] bg-[var(--sf-surface)] p-6 shadow-[var(--sf-shadow)]"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--sf-primary)] text-[var(--sf-on-primary)]">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--sf-ink-soft)]">{title}</h3>
        <div>{children}</div>
      </div>
    </motion.div>
  );
}
