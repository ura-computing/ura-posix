/** Lumière — Contact page. Address + hours + phone + WhatsApp CTA + a
 *  mailto contact form. Not customizable (only colors/typography adopt
 *  the brand). */

import { motion } from "framer-motion";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { blurUpVariants, viewportOnce } from "../_shared/motion";
import { whatsappOrderLink } from "../_shared/mockStore";
import type { TemplateProps } from "../_shared/customizationTypes";

import { LumiereShell } from "./Shell";
import { LumiereStyles } from "./styles";

export function LumiereContact(props: TemplateProps) {
  const { customization, pharmacyPhone } = props;

  return (
    <LumiereShell customization={customization} pharmacyPhone={pharmacyPhone} logoUrl={customization.logoUrl}>
      <LumiereStyles />
      <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
        <motion.header
          className="mb-10 flex flex-col items-start gap-3"
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={blurUpVariants}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lum-primary)]">Contact</span>
          <h1 className="font-[family-name:var(--lum-font-display)] text-4xl font-semibold text-[var(--lum-ink)] sm:text-5xl">
            Une équipe à votre écoute
          </h1>
          <p className="max-w-2xl text-lg text-[var(--lum-ink-soft)]">
            Une question, un conseil, une commande particulière ? Nous répondons rapidement.
          </p>
        </motion.header>

        <div className="grid gap-10 md:grid-cols-[1.05fr_.95fr]">
          {/* Info column */}
          <motion.section
            className="flex flex-col gap-5"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={blurUpVariants}
          >
            <InfoCard icon={<MapPin className="size-5" />} title="Adresse">
              12 rue des Fleurs
              <br />
              Bouskoura, Maroc
            </InfoCard>
            <InfoCard icon={<Phone className="size-5" />} title="Téléphone">
              <a
                href={`tel:${pharmacyPhone}`}
                className="font-[family-name:var(--lum-font-mono)] text-lg font-semibold text-[var(--lum-primary)] hover:underline"
              >
                {pharmacyPhone}
              </a>
            </InfoCard>
            <InfoCard icon={<Clock className="size-5" />} title="Horaires">
              Lundi—Samedi · 8h—20h
              <br />
              Dimanche · fermé
            </InfoCard>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={whatsappOrderLink(pharmacyPhone, "votre demande")}
                target="_blank"
                rel="noopener"
                className="lum-cta"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
              <a
                href={`tel:${pharmacyPhone}`}
                className="text-sm font-semibold text-[var(--lum-ink)] underline-offset-4 hover:underline"
              >
                Nous appeler
              </a>
            </div>

            {/* Map placeholder */}
            <div className="mt-4 grid h-56 place-items-center rounded-[28px] bg-gradient-to-br from-[var(--lum-secondary)]/40 to-[var(--lum-primary)]/10">
              <MapPin className="size-16 text-[var(--lum-primary)]/70" strokeWidth={1.4} />
            </div>
          </motion.section>

          {/* Contact form */}
          <motion.section
            className="rounded-[32px] bg-white/85 p-8 shadow-[0_30px_70px_-40px_rgba(0,0,0,.15)] ring-1 ring-black/[.04] backdrop-blur"
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
            variants={blurUpVariants}
          >
            <h2 className="font-[family-name:var(--lum-font-display)] text-2xl font-semibold text-[var(--lum-ink)]">
              Écrivez-nous
            </h2>
            <p className="mt-2 text-sm text-[var(--lum-ink-soft)]">Nous vous répondons sous 24 h ouvrées.</p>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = fd.get("name") as string;
                const msg = fd.get("message") as string;
                window.location.href = `mailto:contact@pharmacielumiere.ma?subject=${encodeURIComponent(`Message de ${name}`)}&body=${encodeURIComponent(msg)}`;
              }}
            >
              <Field label="Nom">
                <input name="name" required className="lum-input" placeholder="Votre nom" />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required className="lum-input" placeholder="vous@email.com" />
              </Field>
              <Field label="Message">
                <textarea
                  name="message"
                  required
                  rows={5}
                  className="lum-input resize-none"
                  placeholder="Comment pouvons-nous vous aider ?"
                />
              </Field>
              <button type="submit" className="lum-cta mt-2 w-fit">
                <Mail className="size-4" />
                Envoyer
              </button>
            </form>
          </motion.section>
        </div>
      </div>

      <style>{`
        .lum-input {
          width: 100%;
          padding: 12px 16px;
          font-family: var(--lum-font-body);
          font-size: 14px;
          background: rgba(255,255,255,.6);
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 14px;
          color: var(--lum-ink);
          transition: border-color .2s, box-shadow .2s;
          outline: none;
        }
        .lum-input:focus {
          border-color: var(--lum-primary);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--lum-primary), transparent 82%);
        }
      `}</style>
    </LumiereShell>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-white/70 p-5 ring-1 ring-black/[.04] backdrop-blur">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--lum-ink-soft)]">{label}</span>
      the store is a hidden feature tha twould be fully implemented later on add a comamnd in pakcage.json that format
      the code so the cod ecan be fully consistent {children}
    </label>
  );
}
