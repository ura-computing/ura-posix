import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TriangleAlert, Info } from "lucide-react";

import { AsyncButton } from "./AsyncButton";
import { cn } from "@/utils/cn";
import { useT } from "@/i18n/I18nProvider";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  bullets?: string[];
  variant?: "default" | "destructive";
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  bullets,
  variant = "default",
  confirmLabel,
  loadingLabel,
  cancelLabel,
  isLoading = false,
}: ConfirmDialogProps) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !isLoading && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isLoading, onClose]);

  const destructive = variant === "destructive";
  const Icon = destructive ? TriangleAlert : Info;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isLoading && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative max-h-[calc(100vh-2rem)] w-full max-w-[550px] overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-md"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex gap-3.5">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  destructive ? "bg-error-subtle text-error" : "bg-accent text-primary",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
                {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
                {bullets && bullets.length > 0 && (
                  // A long list (e.g. 36 imports) scrolls inside: the buttons stay on screen.
                  <ul className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto pr-1 text-sm text-muted-foreground">
                    {bullets.map((b, i) => (
                      // The same text can repeat (one file imported twice).
                      <li key={i} className="flex gap-1.5">
                        <span aria-hidden>·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <AsyncButton variant="ghost" onClick={onClose} disabled={isLoading}>
                {cancelLabel ?? t("common.cancel")}
              </AsyncButton>
              <AsyncButton
                variant={destructive ? "destructive" : "primary"}
                onClick={onConfirm}
                isLoading={isLoading}
                loadingText={loadingLabel ?? t("shared.processing")}
              >
                {confirmLabel ?? t("common.confirm")}
              </AsyncButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
