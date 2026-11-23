/** A small square of one color (its hex as tooltip): a store's colors, the model picker.
 *  Example: `<ColorSwatch color="#0E9E8C" />`; `size="md"` for a bigger one. */
import { cn } from "@/utils/cn";

const SIZE = { sm: "size-4 rounded", md: "size-6 rounded-md" } as const;

export function ColorSwatch({ color, size = "sm" }: { color: string; size?: keyof typeof SIZE }) {
  return (
    <span
      className={cn("inline-block shrink-0 border border-border", SIZE[size])}
      style={{ background: color }}
      title={color}
    />
  );
}
