/** Lumière — Contact: the pharmacy's own address and phone, « Écrire sur WhatsApp » and « Appeler ». No form: the
 *  pharmacy answers on WhatsApp. */

import { motion } from "framer-motion";
import { MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";

import type { TemplateProps } from "../_shared/customizationTypes";
import { blurUpVariants } from "../_shared/motion";
import { contactText, whatsappLink } from "../_shared/storefront";

import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";

export function LumiereContact(props: TemplateProps) {
  const { store, pharmacyPhone, customization } = props;
  const address = [store.summary?.address, store.summary?.city].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent([customization.storeName, address].filter(Boolean).join(", "));

  return (
    <LumiereShell props={props}>
      <LumiereStyles />
      <motion.div
        className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14"
        initial="hidden"
        animate="show"
        variants={blurUpVariants}
      >
        <header className="flex flex-col items-start gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-primary)]">Contact</span>
          <h1 className="font-[family-name:var(--lum-font-display)] text-4xl font-semibold text-[var(--lum-ink)] sm:text-5xl">
            Une question ? Écrivez-nous.
          </h1>
          <p className="max-w-2xl text-lg text-[var(--lum-ink-soft)]">
            Disponibilité d'un produit, conseil, commande : la pharmacie vous répond sur WhatsApp.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          <InfoCard icon={<MessageCircle className="size-5" />} title="WhatsApp">
            <a
              href={whatsappLink(pharmacyPhone, contactText)}
              target="_blank"
              rel="noopener noreferrer"
              className="lum-cta mt-2 w-fit text-[13px]"
            >
              Écrire maintenant
            </a>
          </InfoCard>
          <InfoCard icon={<Phone className="size-5" />} title="Téléphone">
            <a href={`tel:${pharmacyPhone}`} className="font-semibold hover:underline">
              {pharmacyPhone}
            </a>
          </InfoCard>
          {address && (
            <InfoCard icon={<MapPin className="size-5" />} title="Adresse">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {address}
              </a>
            </InfoCard>
          )}
        </div>
      </motion.div>
    </LumiereShell>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-3xl bg-white/80 p-6 ring-1 ring-black/[.04] backdrop-blur">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--lum-primary)]/12 text-[var(--lum-primary)]">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--lum-ink-soft)]">{title}</h3>
        <div className="text-[var(--lum-ink)]">{children}</div>
      </div>
    </div>
  );
}
