/** One block of a page, in the app's look (Tableau de bord, Stock, the product sheet, a store request): the title in
 *  small grey capitals (+ a small hint), its buttons on the right, its content. */
import type { ReactNode } from "react";

import { Card } from "@/_components/atoms/Card";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { cn } from "@/utils/cn";

export function SectionCard({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title: string;
  /** Small text after the title, e.g. « du 22 sept. 2026 au 21 oct. 2026 ». */
  hint?: string;
  /** Right of the title (e.g. « Éditer », « Voir tout »). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-3", className)}>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <SectionTitle hint={hint}>{title}</SectionTitle>
        {actions}
      </div>
      {children}
    </Card>
  );
}
