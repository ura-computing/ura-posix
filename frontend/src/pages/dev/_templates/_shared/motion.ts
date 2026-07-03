/** Framer Motion variants shared by templates.
 *
 *  Templates should compose these rather than roll their own to keep the
 *  motion vocabulary coherent (blur-in reveals + staggered children +
 *  soft entrance). Per-template personality (parallax leaves, 3D tilt,
 *  etc.) stays local to that template's own tsx. */

import type { Variants } from "framer-motion";


/** Blur-in rise, used as the base entrance for every section. */
export const blurUpVariants: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(12px)" },
  show:   {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.9, ease: [0.2, 0.7, 0.2, 1] },
  },
};


/** Staggered container: children reveal one after the other. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};


/** Softer variant for small items (chips, category cards). */
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};


/** IntersectionObserver-friendly viewport props for whileInView. */
export const viewportOnce = { once: true, amount: 0.35 };
