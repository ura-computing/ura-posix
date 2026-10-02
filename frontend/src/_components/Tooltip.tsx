import { useRef, useState, type ReactNode } from "react";


type Placement = "right" | "top" | "bottom" | "left";


/** Lightweight hover/focus tooltip. Renders via `position: fixed` so it
 *  escapes ANY parent's overflow/clipping/stacking context. No deps, no portal. */
export function Tooltip({
  label, placement = "right", className = "relative inline-flex", children,
}: { label: string; placement?: Placement; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (!label) return <>{children}</>;

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const next = (() => {
      switch (placement) {
        case "right":  return { top: r.top + r.height / 2, left: r.right + gap };
        case "left":   return { top: r.top + r.height / 2, left: r.left  - gap };
        case "top":    return { top: r.top  - gap,         left: r.left + r.width / 2 };
        case "bottom": return { top: r.bottom + gap,       left: r.left + r.width / 2 };
      }
    })();
    setPos(next);
  };
  const hide = () => setPos(null);

  // Tooltip's transform pulls it to the correct side of its anchor point.
  const transform = {
    right:  "translate(0, -50%)",
    left:   "translate(-100%, -50%)",
    top:    "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
  }[placement];

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && (
        <span
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, transform }}
          className="pointer-events-none z-[100] whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-md"
        >
          {label}
        </span>
      )}
    </span>
  );
}