/** Minimal Dialog primitive — shadcn-compatible API surface, zero deps.
 *
 *  Usage:
 *    <Dialog open={open} onOpenChange={setOpen}>
 *      <DialogContent className="max-w-5xl">
 *        ...content...
 *      </DialogContent>
 *    </Dialog>
 *
 *  Behaviour:
 *    - Centered overlay (fixed inset-0) over a dim backdrop
 *    - Click backdrop OR press Esc → calls onOpenChange(false)
 *    - Body scroll locked while open
 *    - Renders nothing when open=false (no portal needed for our usage)
 */
import { useEffect, type ReactNode } from "react";

import { cn } from "@/utils/cn";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => onOpenChange(false)}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      {/* children stop-propagation handled by DialogContent */}
      {children}
    </div>
  );
}

export interface DialogContentProps {
  className?: string;
  children: ReactNode;
}

export function DialogContent({ className, children }: DialogContentProps) {
  return (
    <div
      className={cn(
        "relative z-10 w-full overflow-hidden rounded-xl border border-border bg-card shadow-2xl",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
