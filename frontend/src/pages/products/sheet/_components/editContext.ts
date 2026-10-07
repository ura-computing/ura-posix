/** The owner's « Modifier » state + the sheet, for every editable value of the page (`Editable`). */
import { createContext } from "react";

import type { ProductSheet } from "@/types";

import type { SheetEditor } from "../hooks";

export const SheetEditContext = createContext<{ editor: SheetEditor; sheet: ProductSheet } | null>(null);
