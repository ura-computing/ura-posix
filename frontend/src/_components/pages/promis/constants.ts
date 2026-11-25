/** « Promis »: each state's badge color, the list's state filter, each step's icon (buttons, pop-ups). */
import { Archive, CircleX, PackageCheck, TriangleAlert, Truck, Undo2, UserCheck, type LucideIcon } from "lucide-react";

import type { BadgeTone } from "@/_components/atoms/Badge";
import type { PromisState } from "@/types/promis";

export const STATE_TONE: Record<PromisState, BadgeTone> = {
  created: "info",
  to_order: "warning",
  ordered: "info",
  received: "info",
  incident: "error",
  ready: "success",
  picked_up: "neutral",
  expired: "error",
  returned: "neutral",
  cancelled: "neutral",
};
export const STATES = Object.keys(STATE_TONE) as PromisState[];

export const ICON: Partial<Record<PromisState, LucideIcon>> = {
  ordered: Truck,
  received: PackageCheck,
  ready: Archive,
  picked_up: UserCheck,
  returned: Undo2,
  incident: TriangleAlert,
  cancelled: CircleX,
};
