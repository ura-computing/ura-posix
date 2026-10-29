import type { HTMLAttributes, Ref } from "react";
import { Plus, GripVertical, Sparkles, FolderPlus, Star } from "lucide-react";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { KebabMenu } from "@/_components/molecules/KebabMenu";
import { Button } from "@/_components/atoms/Button";
import { MAX_STORE_CATEGORIES, STORE_CATEGORY_WARN_AT, type StoreCategory } from "@/types/storeWebsite";

import { CategoryIcon } from "./categoryIcons";

/** TAB 2 — CATÉGORIES.
 *
 *  Owner organises products into shop-facing categories (max 12).
 *  - "Autres" is always pinned first, never deletable, never sortable
 *  - Cards drag-reorderable via @dnd-kit/sortable (grip handle only)
 *  - Soft warn at 10, hard cap at 12
 *  - "Mis à jour par votre développeur" badge stays for 7 days */

export interface CategoriesTabProps {
  categories: StoreCategory[];
  /** Set of category ids that the owner has marked "vedette" — persisted on
   *  the active request's customization. Empty when there's no active
   *  request; toggling in that case just shows an info toast. */
  featuredIds?: string[];
  isLoading?: boolean;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Fires after a drag settles with the new ordered id list (including
   *  the pinned default at index 0). */
  onReorder: (orderedIds: string[]) => void;
  onToggleFeatured?: (categoryId: string) => void;
}

export function CategoriesTab({
  categories,
  featuredIds = [],
  isLoading,
  onCreate,
  onEdit,
  onDelete,
  onReorder,
  onToggleFeatured,
}: CategoriesTabProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  const defaultCategory = categories.find((c) => c.isDefault) ?? null;
  const sortable = categories.filter((c) => !c.isDefault);
  const sortableIds = sortable.map((c) => c.id);

  const realCount = sortable.length;
  const nearLimit = realCount >= STORE_CATEGORY_WARN_AT && realCount < MAX_STORE_CATEGORIES;
  const atLimit = realCount >= MAX_STORE_CATEGORIES;

  if (realCount === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = sortableIds.indexOf(String(active.id));
    const newIdx = sortableIds.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(sortableIds, oldIdx, newIdx);
    onReorder(defaultCategory ? [defaultCategory.id, ...next] : next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Organisez vos produits en catégories personnalisées qui apparaîtront sur votre site (ex&nbsp;: Soins bébé,
          Bien-être, Vitamines). Ces catégories ne servent qu'à votre site public, elles ne modifient pas vos rapports
          internes.
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {realCount}/{MAX_STORE_CATEGORIES} catégories
          </span>
          <Button onClick={onCreate} disabled={atLimit}>
            <Plus className="size-4" />
            Nouvelle catégorie
          </Button>
        </div>
      </div>

      {nearLimit && (
        <p className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-sm font-medium text-warning-subtle-foreground">
          Vous approchez de la limite recommandée.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <GripVertical className="size-3.5" />
        Glissez pour réorganiser l'ordre d'affichage sur votre site.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {defaultCategory && (
              <CategoryCard
                category={defaultCategory}
                featured={featuredIds.includes(defaultCategory.id)}
                onToggleFeatured={onToggleFeatured}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
            {sortable.map((c) => (
              <SortableCategoryCard
                key={c.id}
                category={c}
                featured={featuredIds.includes(c.id)}
                onToggleFeatured={onToggleFeatured}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ── Cards ──────────────────────────────────────────────────────────────────

interface CategoryCardProps {
  category: StoreCategory;
  featured?: boolean;
  onToggleFeatured?: (categoryId: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Spread onto the grip handle when this card is wrapped by
   *  `SortableCategoryCard`. Undefined for the pinned "Autres" card. */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> };
}

function CategoryCard({ category, featured, onToggleFeatured, onEdit, onDelete, dragHandleProps }: CategoryCardProps) {
  const draggable = !category.isDefault && dragHandleProps;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-surface-subtle/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-lg"
            style={{ background: `${category.color}1f`, color: category.color }}
          >
            <CategoryIcon name={category.icon} className="size-5" />
          </span>
          {draggable && (
            <button
              type="button"
              aria-label="Glisser pour réorganiser"
              className="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
              {...dragHandleProps}
            >
              <GripVertical className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!category.isDefault && onToggleFeatured && (
            <button
              type="button"
              onClick={() => onToggleFeatured(category.id)}
              aria-pressed={featured}
              aria-label={featured ? "Retirer de la vedette" : "Mettre en vedette"}
              title={featured ? "Retirer de la vedette" : "Mettre en vedette sur la page d'accueil"}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground data-[on=true]:text-amber-500"
              data-on={featured}
            >
              <Star className={featured ? "size-4 fill-current" : "size-4"} />
            </button>
          )}
          {!category.isDefault && (
            <KebabMenu>
              {(close) => (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit(category.id);
                      close();
                    }}
                    className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-foreground hover:bg-surface-subtle"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(category.id);
                      close();
                    }}
                    className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-error-subtle-foreground hover:bg-error-subtle"
                  >
                    Supprimer
                  </button>
                </>
              )}
            </KebabMenu>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">{category.name}</h3>
          {category.isDefault && (
            <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Par défaut
            </span>
          )}
        </div>
        {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{category.productCount} produits</span>
        {category.updatedByDeveloper && (
          <span className="inline-flex items-center gap-1 rounded-full bg-info-subtle px-2 py-0.5 text-[11px] font-semibold text-info-subtle-foreground">
            <Sparkles className="size-3" />
            Mis à jour par votre développeur
          </span>
        )}
      </div>
    </article>
  );
}

/** Sortable wrapper around `CategoryCard`. The drag handle is the grip
 *  button inside the card — not the whole card — so clicks on the kebab
 *  menu and content still work normally. */
function SortableCategoryCard(props: Omit<CategoryCardProps, "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : undefined}>
      <CategoryCard
        {...props}
        dragHandleProps={{
          ref: setActivatorNodeRef,
          ...attributes,
          ...listeners,
        }}
      />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-subtle text-primary">
        <FolderPlus className="size-6" />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">
        Créez votre première catégorie pour commencer à organiser votre boutique.
      </p>
      <Button onClick={onCreate}>
        <Plus className="size-4" />
        Nouvelle catégorie
      </Button>
    </div>
  );
}
