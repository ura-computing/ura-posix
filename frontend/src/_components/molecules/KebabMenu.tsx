/** Floating kebab dropdown that escapes parent `overflow-hidden` clipping.
 *
 *  Tables on /admin/pharmacies/{id} and /owner/employees live inside a
 *  `<section className="overflow-hidden rounded-xl ...">` wrapper for the
 *  rounded-card visual. A plain absolutely-positioned dropdown gets clipped
 *  by that wrapper — this primitive portals the menu to `document.body`
 *  with viewport-fixed coords, mirroring the `ConfirmDialog` pattern.
 *
 *  Children = the menu items: `KebabItem` (one look; `danger` for « Supprimer », « Désactiver »).
 *  Click-outside closes; Escape closes; re-clicking the trigger toggles.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

/** Room (px) the menu needs below its trigger; with less, it opens upward. */
const MENU_SPACE = 180;

export function KebabMenu({ label, children }: { label?: string; children: (close: () => void) => ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = () => setOpen(false);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const right = window.innerWidth - r.right; // right-aligned to the trigger
      // Below the trigger — or above it near the window's bottom edge: a fixed
      // menu placed off-screen can't be scrolled to (last rows of a table).
      setPos(
        window.innerHeight - r.bottom < MENU_SPACE
          ? { bottom: window.innerHeight - r.top + 4, right }
          : { top: r.bottom + 4, right },
      );
    }
    setOpen((p) => !p);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={label ?? t("shared.moreActions")}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={close} />
            <div
              role="menu"
              style={{ position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right }}
              className="z-[91] w-56 rounded-md border border-border bg-card p-1 shadow-lg"
            >
              {children(close)}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/** One line of a `KebabMenu`: `onSelect` runs, then the menu closes (pass the menu's `close`). */
export function KebabItem({
  icon,
  danger,
  onSelect,
  close,
  children,
}: {
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        onSelect();
        close();
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left text-sm",
        danger ? "text-destructive hover:bg-destructive/5" : "text-foreground hover:bg-surface-subtle",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
