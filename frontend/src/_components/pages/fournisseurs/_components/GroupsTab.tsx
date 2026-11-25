/** « Groupements » (Fournisseurs, tab): pharmacies that buy together. None known yet: an empty place with « Ajouter
 *  un groupement ». Each group: its name, its pharmacies, « ⋮ » → « Modifier » / « Supprimer » (asks first). */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { API, refresh } from "@/api/api";
import { api } from "@/api/client";
import { Button } from "@/_components/atoms/Button";
import { Checkbox } from "@/_components/atoms/Checkbox";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { SearchInput, Textarea } from "@/_components/atoms/Input";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { KebabItem, KebabMenu } from "@/_components/molecules/KebabMenu";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { SkeletonCard } from "@/_components/molecules/Skeletons";
import { useAdminPharmaciesList } from "@/hooks/useSharedQueries";
import { useT } from "@/i18n/I18nProvider";
import type { PurchasingGroup, PurchasingGroupInput } from "@/types/suppliers";
import { matchesFields } from "@/utils/text";

function useGroups() {
  const t = useT();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: API.admin.groups.key,
    queryFn: () => api.get<PurchasingGroup[]>(API.admin.groups.url),
  });
  const done = () => {
    toast.success(t("groups.saved"));
    void refresh(qc, API.admin.addGroup);
  };
  const { mutateAsync: save, isPending: isSaving } = useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: PurchasingGroupInput }) =>
      id ? api.put(API.admin.editGroup.url(id), body) : api.post(API.admin.addGroup.url, body),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: number) => api.delete(API.admin.editGroup.url(id)),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  return {
    groups: data ?? [],
    isLoading,
    saveGroup: (id: number | null, body: PurchasingGroupInput) => save({ id, body }).then(() => undefined),
    isSaving,
    deleteGroup: (id: number) => remove(id).then(() => undefined),
  };
}

function GroupForm({
  group,
  onSave,
  isSaving,
  onClose,
}: {
  group: PurchasingGroup | null;
  onSave: (id: number | null, body: PurchasingGroupInput) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { pharmacies } = useAdminPharmaciesList();
  const [name, setName] = useState(group?.name ?? "");
  const [note, setNote] = useState(group?.note ?? "");
  const [picked, setPicked] = useState<number[]>(group?.pharmacies.map((p) => p.id) ?? []);
  const [search, setSearch] = useState("");
  const shown = (pharmacies ?? []).filter((p) => !p.archived_at && matchesFields([p.name, p.code, p.city], search));
  const toggle = (id: number) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  const save = async () => {
    await onSave(group?.id ?? null, { name: name.trim(), note: note.trim() || null, pharmacy_ids: picked });
    onClose();
  };
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader
        icon={<UsersRound className="size-4" />}
        title={t(group ? "groups.editTitle" : "groups.addTitle")}
        onClose={onClose}
      />
      <DialogBody>
        <FormField label={t("groups.name")} required>
          <FormInput
            value={name}
            onChange={setName}
            maxLength={120}
            autoFocus
            placeholder={t("groups.namePlaceholder")}
          />
        </FormField>
        <FormField label={t("groups.pharmacies", { n: picked.length })} group>
          <SearchInput value={search} onValueChange={setSearch} placeholder={t("groups.searchPharmacy")} />
          <ul className="flex max-h-60 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-subtle">
                  <Checkbox checked={picked.includes(p.id)} onChange={() => toggle(p.id)} className="size-5" />
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">{[p.code, p.city].filter(Boolean).join(" · ")}</span>
                </label>
              </li>
            ))}
          </ul>
        </FormField>
        <FormField label={t("groups.note")}>
          <Textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </DialogBody>
      <DialogFooter>
        {!name.trim() && <span className="mr-auto text-sm text-muted-foreground">{t("groups.needName")}</span>}
        <Button variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button onClick={() => void save()} disabled={!name.trim()} isLoading={isSaving}>
          {t("common.save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function GroupsTab() {
  const t = useT();
  const { groups, isLoading, saveGroup, isSaving, deleteGroup } = useGroups();
  const [editing, setEditing] = useState<PurchasingGroup | "new" | null>(null);
  const [removing, setRemoving] = useState<PurchasingGroup | null>(null);
  const add = (
    <Button onClick={() => setEditing("new")}>
      <Plus className="size-4" />
      {t("groups.add")}
    </Button>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("groups.intro")}</p>
        {groups.length > 0 && add}
      </div>
      {isLoading ? (
        <SkeletonCard lines={3} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-6" />}
          title={t("groups.emptyTitle")}
          hint={t("groups.emptyHint")}
          action={add}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map((g) => (
            <SectionCard
              key={g.id}
              title={g.name}
              hint={t("groups.pharmacies", { n: g.pharmacies.length })}
              actions={
                <KebabMenu label={t("groups.actions")}>
                  {(close) => (
                    <>
                      <KebabItem icon={<Pencil className="size-3.5" />} onSelect={() => setEditing(g)} close={close}>
                        {t("common.edit")}
                      </KebabItem>
                      <KebabItem
                        icon={<Trash2 className="size-3.5" />}
                        danger
                        onSelect={() => setRemoving(g)}
                        close={close}
                      >
                        {t("common.delete")}
                      </KebabItem>
                    </>
                  )}
                </KebabMenu>
              }
            >
              <p className="text-sm text-foreground">
                {g.pharmacies.length ? g.pharmacies.map((p) => p.name).join(", ") : t("groups.noPharmacy")}
              </p>
              {g.note && <p className="text-sm text-muted-foreground">{g.note}</p>}
            </SectionCard>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing !== null && (
          <GroupForm
            key={editing === "new" ? "new" : editing.id}
            group={editing === "new" ? null : editing}
            onSave={saveGroup}
            isSaving={isSaving}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        variant="destructive"
        title={t("groups.removeTitle", { name: removing?.name ?? "" })}
        description={t("groups.removeDesc")}
        confirmLabel={t("common.delete")}
        onConfirm={async () => {
          if (removing) await deleteGroup(removing.id);
          setRemoving(null);
        }}
      />
    </>
  );
}
