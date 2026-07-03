/** Route container for /store-website (owner).
 *
 *  Tab 1 (Demande) now reads from the real backend via `useMyRequest`;
 *  Tab 2 (Catégories) + Tab 3 (Produits) still use local state + mock
 *  fixtures because the products/categories are not backend-wired yet
 *  (deferred to a follow-up chunk).
 *
 *  Featured-categories persistence: Tab 2's Vedette star toggle calls
 *  `patchFeaturedCategories` on the active request's customization row. */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import type { StoreCategory, VisibleProduct } from "@/types/storeWebsite";
import type { PastRequest } from "@/types/storeWebsite";


/** Bootstrap categories — only the non-deletable "Autres" bucket is present
 *  by default. Real per-pharmacy CRUD lands when the categories endpoint
 *  ships; for now the owner can create + delete in-session (state is lost
 *  on reload). */
const INITIAL_CATEGORIES: StoreCategory[] = [
  {
    id:                 "cat-default",
    name:               "Autres",
    description:        "Produits sans catégorie attribuée.",
    icon:               "vitamines",
    color:              "#0E9E8C",
    productCount:       0,
    updatedByDeveloper: false,
    isDefault:          true,
  },
];

import { StoreWebsitePage, type StoreTab } from "./_components/StoreWebsitePage";
import { CategoryModal, type CategoryValues } from "./_components/CategoryModal";
import { apiToWebsiteRequest } from "./_hooks/apiToWebsiteRequest";
import { useMyRequest } from "./_hooks/useMyRequest";


const NO_PAST_REQUESTS: PastRequest[] = [];


function isStoreTab(s: string | null): s is StoreTab {
  return s === "demande" || s === "categories" || s === "produits";
}


export default function StoreWebsiteRoute() {
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();
  const initialTab         = isStoreTab(searchParams.get("tab")) ? searchParams.get("tab") as StoreTab : "demande";

  // ── Tab 1 state: fetched from backend ──────────────────────────────────
  const { request: apiRequest, isLoading, patchFeaturedCategories } = useMyRequest();
  const activeRequest = useMemo(
    () => (apiRequest ? apiToWebsiteRequest(apiRequest) : null),
    [apiRequest],
  );

  // ── Tab 2 state: categories ──────────────────────────────────────────────
  // Starts with just the non-deletable "Autres" bucket. Real backend
  // persistence lands when the categories endpoint ships; today the owner
  // can create/edit/delete in-session (state resets on reload).
  const [categories, setCategories] = useState<StoreCategory[]>(INITIAL_CATEGORIES);
  const [editing,    setEditing]    = useState<StoreCategory | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  // ── Tab 3 state: products ────────────────────────────────────────────────
  // Empty until the pharmacy_store_product_settings endpoint lands. Wired
  // as a normal state slice so incremental additions work as soon as the
  // backend is ready.
  const [products,     setProducts]     = useState<VisibleProduct[]>([]);
  const [search,       setSearch]       = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // ── Tab 2 mutations ──────────────────────────────────────────────────────
  const handleCreate = () => { setEditing(null); setModalOpen(true); };
  const handleEdit   = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (cat) { setEditing(cat); setModalOpen(true); }
  };
  const handleDelete = (id: string) => {
    setCategories((cs) => cs.filter((c) => c.id !== id));
    toast.success("Catégorie supprimée");
  };
  const handleReorder = (orderedIds: string[]) => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    setCategories(orderedIds.map((id) => byId.get(id)!).filter(Boolean));
  };
  const handleSubmitCategory = (v: CategoryValues) => {
    if (editing) {
      setCategories((cs) => cs.map((c) => c.id === editing.id ? { ...c, ...v } : c));
      toast.success("Catégorie modifiée");
    } else {
      setCategories((cs) => [...cs, {
        id:                 `cat-${Date.now()}`,
        name:               v.name,
        description:        v.description || null,
        icon:               v.icon,
        color:              v.color,
        productCount:       0,
        updatedByDeveloper: false,
      }]);
      toast.success("Catégorie créée");
    }
    setModalOpen(false);
  };

  // ── Tab 3 mutations ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCats.length > 0 && !selectedCats.includes(p.storeCategoryId ?? "cat-default")) {
        return false;
      }
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sobrusCategory.toLowerCase().includes(q);
    });
  }, [products, search, selectedCats]);

  const handleToggleVisible  = (id: string, visible: boolean) =>
    setProducts((ps) => ps.map((p) => p.id === id ? { ...p, visible } : p));
  const handleBulkVisibility = (visible: boolean) =>
    setProducts((ps) => ps.map((p) => ({ ...p, visible })));
  const handleAssignCategory = (id: string, categoryId: string | null) =>
    setProducts((ps) => ps.map((p) => p.id === id ? { ...p, storeCategoryId: categoryId } : p));
  const handleSetSolde       = (id: string, solde: number | null) =>
    setProducts((ps) => ps.map((p) => p.id === id ? { ...p, solde } : p));

  // ── Tab 1 handlers (Demande) ─────────────────────────────────────────────
  const handleCreateRequest = () => navigate("/store-website/new");
  const handleEditRequest   = () => navigate("/store-website/new");
  const handleCancelRequest = () => toast.info("Annulation simulée — backend à venir");
  const handleReuseRequest  = () => navigate("/store-website/new");

  // ── Vedette toggle (Tab 2 → customization.featured_category_ids) ────────
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const handleToggleFeatured = async (categoryId: string) => {
    if (!apiRequest) {
      toast.info("Créez d'abord une demande pour épingler des catégories en vedette.");
      return;
    }
    const next = featuredIds.includes(categoryId)
      ? featuredIds.filter((id) => id !== categoryId)
      : [...featuredIds, categoryId];
    setFeaturedIds(next);
    try {
      await patchFeaturedCategories(apiRequest.id, next);
    } catch {
      // Roll back optimistic update on failure.
      setFeaturedIds(featuredIds);
      toast.error("Impossible d'enregistrer la vedette.");
    }
  };

  return (
    <>
      <StoreWebsitePage
        initialTab={initialTab}
        demande={{
          activeRequest,
          pastRequests:       NO_PAST_REQUESTS,
          isLoading,
          onCreate:           handleCreateRequest,
          onEdit:             handleEditRequest,
          onCancel:           handleCancelRequest,
          onReuse:            handleReuseRequest,
        }}
        categories={{
          categories,
          featuredIds,
          onToggleFeatured: handleToggleFeatured,
          onCreate:  handleCreate,
          onEdit:    handleEdit,
          onDelete:  handleDelete,
          onReorder: handleReorder,
        }}
        produits={{
          products:             filteredProducts,
          categories,
          requestState:         activeRequest?.state ?? null,
          search,
          onSearch:             setSearch,
          selectedCategoryIds:  selectedCats,
          onSelectedCategories: setSelectedCats,
          onToggleVisible:      handleToggleVisible,
          onBulkVisibility:     handleBulkVisibility,
          onAssignCategory:     handleAssignCategory,
          onSetSolde:           handleSetSolde,
        }}
      />

      <CategoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        category={editing ?? undefined}
        onSubmit={handleSubmitCategory}
      />
    </>
  );
}
