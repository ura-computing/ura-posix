/** A barcode drawn from its number (`utils/barcode.ts`), black on white in both themes. */
import { useT } from "@/i18n/I18nProvider";
import { barcodeBars } from "@/utils/barcode";
import { cn } from "@/utils/cn";

export function BarcodeImage({ code, className }: { code: string; className?: string }) {
  const t = useT();
  const drawn = barcodeBars(code);
  if (!drawn) return null;
  return (
    <span className={cn("inline-flex shrink-0 rounded bg-white px-1.5 py-1 text-black", className)}>
      <svg
        viewBox={`0 0 ${drawn.width} 40`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t("products.barcodeImage", { code })}
        className="size-full"
      >
        {drawn.bars.map((b) => (
          <rect key={b.x} x={b.x} y={0} width={b.w} height={40} fill="currentColor" />
        ))}
      </svg>
    </span>
  );
}
