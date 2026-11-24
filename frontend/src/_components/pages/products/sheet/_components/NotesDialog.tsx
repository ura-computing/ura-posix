/** « Observations sur ce produit »: the notes the pharmacy left on it (« à vendre avec … »),
 *  newest first, who and when; « Ajouter une observation »; « Supprimer » (its author or the
 *  owner, asked twice); « J'ai lu » closes (« Fermer » when there is none to read). Opens with the
 *  product page when it has notes.
 *  Mounted only while open: the field starts empty each time. */
import { useState } from "react";
import { Check, StickyNote, Trash2 } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Textarea } from "@/_components/atoms/Input";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { SkeletonText } from "@/_components/molecules/Skeletons";
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
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={isDeleting}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" onClick={() => onDelete(note.id)} isLoading={isDeleting}>
                <Trash2 className="size-4" />
                {t("products.noteDeleteConfirm")}
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" />
              {t("products.noteDelete")}
            </Button>
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
      <DialogHeader
        icon={<StickyNote className="size-4" />}
        title={t("products.notesTitle", { n: notes.length })}
        subtitle={<span className="block truncate">{product}</span>}
        onClose={onClose}
      />

      <DialogBody>
        {isLoading ? (
          <SkeletonText lines={4} />
        ) : notes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("products.notesEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((n) => (
              <NoteItem key={n.id} note={n} onDelete={onDelete} isDeleting={isDeleting} />
            ))}
          </ul>
        )}
      </DialogBody>

      <div className="flex flex-col gap-2 border-t border-border px-5 py-4">
        <label htmlFor="new-note" className="text-sm font-semibold text-foreground">
          {t("products.noteAdd")}
        </label>
        <Textarea
          id="new-note"
          rows={3}
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("products.notePlaceholder")}
          className="resize-y"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{t("products.noteChars", { n: text.length })}</span>
          <Button variant="secondary" onClick={save} disabled={!text.trim()} isLoading={isAdding}>
            {t("products.noteSave")}
          </Button>
        </div>
      </div>

      <DialogFooter>
        {notes.length > 0 ? (
          <Button variant="primary" onClick={onClose}>
            <Check className="size-4" />
            {t("products.notesRead")}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
        )}
      </DialogFooter>
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
