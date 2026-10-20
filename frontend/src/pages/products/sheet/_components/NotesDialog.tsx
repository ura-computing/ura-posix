/** « Observations sur ce produit »: the notes the pharmacy left on it (« à vendre avec … »),
 *  newest first, who and when; « Ajouter une observation »; « Supprimer » (its author or the
 *  owner, asked twice); « J'ai lu » closes. Opens with the product page when it has notes.
 *  Mounted only while open: the field starts empty each time. */
import { useState } from "react";
import { Check, StickyNote, Trash2, X } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { Dialog, DialogContent } from "@/_components/dialog";
import type { ProductNote } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/utils/format";

const MAX = 1000;

interface NotesProps {
  product: string;
  notes: ProductNote[];
  isLoading: boolean;
  onAdd: (text: string) => Promise<unknown>;
  isAdding: boolean;
  onDelete: (noteId: number) => Promise<unknown>;
  isDeleting: boolean;
  onClose: () => void;
}

function NoteItem({
  note,
  onDelete,
  isDeleting,
}: {
  note: ProductNote;
  onDelete: (noteId: number) => Promise<unknown>;
  isDeleting: boolean;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <p className="whitespace-pre-wrap break-words text-base text-foreground">{note.text}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("products.noteBy", { author: note.author, date: formatDateTime(note.created_at) })}
        </span>
        {note.can_delete &&
          (confirming ? (
            <span className="flex items-center gap-2">
              <AsyncButton variant="secondary" onClick={() => setConfirming(false)} disabled={isDeleting}>
                {t("common.cancel")}
              </AsyncButton>
              <AsyncButton variant="destructive" onClick={() => onDelete(note.id)} isLoading={isDeleting}>
                <Trash2 className="size-4" />
                {t("products.noteDeleteConfirm")}
              </AsyncButton>
            </span>
          ) : (
            <AsyncButton variant="ghost" onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" />
              {t("products.noteDelete")}
            </AsyncButton>
          ))}
      </div>
    </li>
  );
}

function NotesContent({ product, notes, isLoading, onAdd, isAdding, onDelete, isDeleting, onClose }: NotesProps) {
  const t = useT();
  const [text, setText] = useState("");
  const save = async () => {
    await onAdd(text.trim());
    setText("");
  };
  return (
    <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-xl flex-col">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-subtle text-warning-subtle-foreground">
          <StickyNote className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h3 className="text-[17px] font-semibold text-foreground">{t("products.notesTitle", { n: notes.length })}</h3>
          <span className="truncate text-sm text-muted-foreground">{product}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="ml-auto cursor-pointer text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("products.notesEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <NoteItem key={n.id} note={n} onDelete={onDelete} isDeleting={isDeleting} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-5 py-4">
        <label htmlFor="new-note" className="text-sm font-semibold text-foreground">
          {t("products.noteAdd")}
        </label>
        <textarea
          id="new-note"
          rows={3}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("products.notePlaceholder")}
          className="w-full resize-y rounded-md border border-input bg-surface-subtle px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{t("products.noteChars", { n: text.length })}</span>
          <AsyncButton variant="secondary" onClick={save} disabled={!text.trim()} isLoading={isAdding}>
            {t("products.noteSave")}
          </AsyncButton>
        </div>
      </div>

      <div className="flex justify-end border-t border-border bg-surface-subtle px-5 py-3.5">
        <AsyncButton variant="primary" onClick={onClose}>
          <Check className="size-4" />
          {t("products.notesRead")}
        </AsyncButton>
      </div>
    </DialogContent>
  );
}

export function NotesDialog({ open, ...props }: NotesProps & { open: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && props.onClose()}>
      <NotesContent {...props} />
    </Dialog>
  );
}
