/** Route container for /store-website (owner).
 *
 *  Reads from the mocked fixtures in `@/fixtures/storeWebsite` and wires
 *  every prop the 3 tabs need. All "mutations" live in local component
 *  state — no API calls. Backend wiring lands in a later chunk. */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import {
  MOCK_ACTIVE_REQUEST, MOCK_PAST_REQUESTS,
  MOCK_STORE_CATEGORIES, MOCK_VISIBLE_PRODUCTS,
} from "@/fixtures/storeWebsite";
import {
  type StoreCategory, type VisibleProduct,
} from "@/types/storeWebsite";

import { StoreWebsitePage, type StoreTab } from "./_components/StoreWebsitePage";
import { CategoryModal, type CategoryValues } from "./_components/CategoryModal";


function isStoreTab(s: string | null): s is StoreTab {
  return s === "demande" || s === "categories" || s === "produits";
}


export default function StoreWebsiteRoute() {
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();
  const initialTab         = isStoreTab(searchParams.get("tab")) ? searchParams.get("tab") as StoreTab : "demande";

  // ── Tab 2 state: categories ──────────────────────────────────────────────
  const [categories, setCategories] = useState<StoreCategory[]>(MOCK_STORE_CATEGORIES);
  const [editing,    setEditing]    = useState<StoreCategory | null>(null);
  const [modalOpen,  setModalOpen]  = useState(false);

  // ── Tab 3 state: products ────────────────────────────────────────────────
  const [products,     setProducts]     = useState<VisibleProduct[]>(MOCK_VISIBLE_PRODUCTS);
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

  return (
    <>
      <StoreWebsitePage
        initialTab={initialTab}
        demande={{
          activeRequest:      MOCK_ACTIVE_REQUEST,
          pastRequests:       MOCK_PAST_REQUESTS,
          onCreate:           handleCreateRequest,
          onEdit:             handleEditRequest,
          onCancel:           handleCancelRequest,
          onReuse:            handleReuseRequest,
        }}
        categories={{
          categories,
          onCreate:  handleCreate,
          onEdit:    handleEdit,
          onDelete:  handleDelete,
          onReorder: handleReorder,
        }}
        produits={{
          products:             filteredProducts,
          categories,
          requestState:         MOCK_ACTIVE_REQUEST.state,
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
