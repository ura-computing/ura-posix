/** Copies a code (PID, barcode) or a table to the clipboard, then « Copié : … » (`copiedText`:
 *  another message). Nothing to copy → shown disabled. `iconOnly`: the small icon of the header;
 *  else « Copier » with its icon. */
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/_components/button";
import { useT } from "@/i18n/I18nProvider";

export function CopyButton({
  value,
  label,
  iconOnly,
  copiedText,
}: {
  value: string | null;
  label: string;
  iconOnly?: boolean;
  copiedText?: string;
}) {
  const t = useT();
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(copiedText ?? t("products.copied", { value }));
    } catch {
      toast.error(t("products.copyFailed"));
    }
  };
  return (
    <Button
      variant={iconOnly ? "ghost" : "outline"}
      size={iconOnly ? "icon" : "sm"}
      onClick={() => void copy()}
      disabled={!value}
      aria-label={label}
      title={label}
    >
      <Copy className="size-4" />
      {!iconOnly && t("products.copy")}
    </Button>
  );
}
