/** « Catégories »: one switch per category of the pharmacy; a category turned off disappears from the site with all
 *  its products. « Tout afficher » turns every one back on. */
import { Tags } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { SkeletonCard } from "@/_components/molecules/Skeletons";
import { SwitchCard } from "@/_components/molecules/SwitchCard";
import { useT } from "@/i18n/I18nProvider";

import { useMyCategories } from "../hooks";

export function CategoriesTab() {
  const t = useT();
  const { categories, isLoading, setShown } = useMyCategories();
  if (isLoading) return <SkeletonCard lines={6} />;

  const toggle = (name: string, on: boolean) => {
    const shown = categories.filter((c) => (c.name === name ? on : c.shown)).map((c) => c.name);
    setShown(shown.length === categories.length ? null : shown);
  };

  return (
    <SectionCard
      title={t("myStore.categoriesTitle")}
      hint={t("myStore.categoriesHint")}
      actions={
        <Button variant="outline" size="sm" disabled={categories.every((c) => c.shown)} onClick={() => setShown(null)}>
          {t("myStore.showAll")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {categories.map((c) => (
          <SwitchCard
            key={c.name}
            icon={Tags}
            title={c.name}
            description={t("myStore.productsCount", { n: c.count })}
            checked={c.shown}
            onChange={(on) => toggle(c.name, on)}
          />
        ))}
      </div>
    </SectionCard>
  );
}
