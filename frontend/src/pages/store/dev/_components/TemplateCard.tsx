/** TemplateCard — animated preview card in the editor's template picker.
 *
 *  Each of the 5 templates gets its own palette + typography sample + a
 *  self-contained CSS gradient animation that carries the template's
 *  personality. Cheap (no JS per frame), respects prefers-reduced-motion. */
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { TEMPLATE_LABEL, type StoreTemplate } from "@/types/storeWebsite";
import { cn } from "@/utils/cn";


interface Preview {
  palette:     [string, string, string];
  displayFont: string;
  sample:      string;
  /** CSS animation name — matches a @keyframes block below. */
  motion:      "bloom" | "ink" | "shine" | "wave" | "gold";
  duration:    string;
}

const TEMPLATE_PREVIEW: Record<StoreTemplate, Preview> = {
  lumiere:   { palette: ["#F4C9D9", "#9BE0C4", "#E9C887"], displayFont: "'Fraunces', 'Playfair Display', serif",         sample: "L",  motion: "bloom", duration: "9s" },
  classique: { palette: ["#F4EEDF", "#C9BFA3", "#6B584A"], displayFont: "'Cormorant', 'Playfair Display', serif",        sample: "A",  motion: "ink",   duration: "12s" },
  moderne:   { palette: ["#F5F5F5", "#0F172A", "#F97316"], displayFont: "'Space Grotesk', 'Inter', sans-serif",           sample: "M",  motion: "shine", duration: "7s" },
  apotheose: { palette: ["#0A0A0A", "#C7A662", "#F5E6C9"], displayFont: "'Playfair Display', 'Cormorant', serif",         sample: "Ap", motion: "gold",  duration: "10s" },
  elegance:  { palette: ["#1E293B", "#7C3AED", "#F59E0B"], displayFont: "'Playfair Display', 'Cormorant', serif",         sample: "É",  motion: "wave",  duration: "11s" },
};

const [P1, P2, P3] = [0, 1, 2] as const;   // helper indices for palette entries


export interface TemplateCardProps {
  template: StoreTemplate;
  active:   boolean;
  onClick:  () => void;
}


export function TemplateCard({ template, active, onClick }: TemplateCardProps) {
  const p = TEMPLATE_PREVIEW[template];

  const gradient = `linear-gradient(135deg, ${p.palette[P1]} 0%, ${p.palette[P2]} 50%, ${p.palette[P3]} 100%)`;
  const sampleColor = template === "apotheose"
    ? "#F5E6C9"                      // gold on dark
    : template === "elegance"
      ? "#F59E0B"                    // amber on slate
      : template === "moderne"
        ? "#0F172A"                  // dark on light
        : "#3D2A1C";                 // dark ink on soft

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.99 }}
      data-active={active}
      className={cn(
        "group relative flex h-24 w-full items-stretch overflow-hidden rounded-xl border-2 border-border text-left transition-colors",
        "data-[active=true]:border-primary",
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
      )}
      aria-pressed={active}
    >
      {/* Animated gradient background */}
      <div
        aria-hidden
        className={`pgcard-motion pgcard-${p.motion}`}
        style={{
          background:       gradient,
          backgroundSize:   "200% 200%",
          animationDuration: p.duration,
        }}
      />
      {/* Content overlay */}
      <div className="relative z-10 flex flex-1 flex-col justify-between p-2.5">
        <div className="flex items-start justify-between">
          <span
            style={{ fontFamily: p.displayFont, color: sampleColor }}
            className="text-xl leading-none font-semibold"
          >
            {p.sample}
          </span>
          {active && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
              <Check className="size-3" />
            </span>
          )}
        </div>
        <span
          style={{ fontFamily: p.displayFont, color: sampleColor }}
          className="text-sm font-medium"
        >
          {TEMPLATE_LABEL[template]}
        </span>
      </div>
      {/* Global keyframes injected once via <style>. Living inline keeps
          the component self-contained — no need for a separate CSS file. */}
      <style>{KEYFRAMES}</style>
    </motion.button>
  );
}


const KEYFRAMES = `
  .pgcard-motion {
    position: absolute; inset: 0;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    will-change: background-position;
  }
  .pgcard-bloom { animation-name: pgcard-bloom; }
  .pgcard-ink   { animation-name: pgcard-ink;   }
  .pgcard-shine { animation-name: pgcard-shine; }
  .pgcard-gold  { animation-name: pgcard-gold;  }
  .pgcard-wave  { animation-name: pgcard-wave;  }
  @keyframes pgcard-bloom { 0%,100% { background-position: 0% 0%;  } 50% { background-position: 100% 100%; } }
  @keyframes pgcard-ink   { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%;  } }
  @keyframes pgcard-shine { 0%,100% { background-position: 20% 0%; } 50% { background-position: 80% 100%;  } }
  @keyframes pgcard-gold  { 0%,100% { background-position: 0% 0%;  } 50% { background-position: 100% 0%;   } }
  @keyframes pgcard-wave  { 0%,100% { background-position: 0% 0%;  } 50% { background-position: 50% 100%;  } }
  @media (prefers-reduced-motion: reduce) {
    .pgcard-motion { animation: none; }
  }
`;
