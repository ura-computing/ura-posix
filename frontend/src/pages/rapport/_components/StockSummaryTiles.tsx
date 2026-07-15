import { AlertTriangle, Boxes, Coins, ShieldCheck, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { cn } from "@/utils/cn";
import { ROUTES } from "@/types";
import type { CategoryType, StockSummaryResponse } from "@/types";

import { useCategoryTint } from "../_hooks/useCategoryTint";


export function StockSummaryTiles({ stock, tint = "all" }: { stock: StockSummaryResponse; tint?: CategoryType }) {
  const { cardClass } = useCategoryTint(tint);
  // Health-tone mapping reuses our semantic tones — same vocabulary as everywhere else.
  const healthTone: IconTone =
    stock.health_pct >= 80 ? "success" :
    stock.health_pct >= 60 ? "warning" : "error";

  // Health value reuses the tone color so the big number itself carries the signal.
  const healthValueClass =
    stock.health_pct >= 80 ? "text-success" :
    stock.health_pct >= 60 ? "text-warning" : "text-error";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          href={ROUTES.STOCK}
          label="Total références"
          value={formatQty(stock.total_references)}
          sub="produits suivis"
          icon={<Boxes className="size-5" />}
          tint={tint}
        />
        <KpiTile
          href={ROUTES.STOCK}
          label="PPV potentiel"
          value={formatMAD(stock.ppv_potentiel)}
          sub="MAD en stock"
          icon={<Coins className="size-5" />}
          tint={tint}
        />
        <KpiTile
          href={ROUTES.STOCK}
          label="Sous-stock / Sur-stock"
          value={<>{formatQty(stock.sous_stock_count)} / {formatQty(stock.sur_stock_count)}</>}
          sub="produits à ajuster"
          icon={<AlertTriangle className="size-5" />}
          tint={tint}
        />
        <KpiTile
          href={ROUTES.STOCK}
          label="Santé du stock"
          value={<span className={cn(healthValueClass)}>{`${stock.health_pct.toFixed(3)} %`}</span>}
          sub="dans la fourchette idéale"
          icon={<ShieldCheck className="size-5" />}
          iconTone={healthTone}
          tint={tint}
        />
      </div>

      {/* Info card + 2 CTAs */}
      <div className={cn("flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center", cardClass)}>
        <div className="flex-1">
          <p className="text-base font-semibold text-foreground">Analyse du stock</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Consultez la classification ABCD, les alertes sous-stock et sur-stock, et les péremptions.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to={ROUTES.STOCK}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Voir le stock
          </Link>
          <Link
            to={`${ROUTES.UPLOAD_FILE}?type=stock`}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-base font-semibold text-foreground hover:bg-surface-subtle"
          >
            <UploadCloud className="size-4" />
            Importer stock
          </Link>
        </div>
      </div>
    </div>
  );
}
