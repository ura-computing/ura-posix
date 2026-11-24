import type { ReactNode } from "react";

/** A tile number + its unit, smaller (like « / 10 » on Stock): « 2 359 unités », « 30 902,90 MAD ». */
export function TileNumber({ value, unit }: { value: ReactNode; unit: string }) {
  return (
    <>
      <span className="whitespace-nowrap">{value}</span>{" "}
      <span className="font-mono text-base font-semibold text-muted-foreground">{unit}</span>
    </>
  );
}
