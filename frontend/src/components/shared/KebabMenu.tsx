/** Floating kebab dropdown that escapes parent `overflow-hidden` clipping.
 *
 *  Tables on /admin/pharmacies/{id} and /owner/employees live inside a
 *  `<section className="overflow-hidden rounded-xl ...">` wrapper for the
 *  rounded-card visual. A plain absolutely-positioned dropdown gets clipped
 *  by that wrapper — this primitive portals the menu to `document.body`
 *  with viewport-fixed coords, mirroring the `ConfirmDialog` pattern.
 *
 *  Children = the menu items. Caller controls their styling.
 *  Click-outside closes; Escape closes; re-clicking the trigger toggles.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";


export function KebabMenu({
  label = "Plus d'actions",
  children,
}: {
  label?:   string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = () => setOpen(false);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      // Right-align to the trigger button; sit just below it.
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
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
        aria-label={label}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={close} />
          <div
            role="menu"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
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
