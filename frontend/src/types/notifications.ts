/** The bell of the top bar (mirrors backend/app/notifications/schemas.py). */

export type NotificationKind =
  "signupRequest" | "storeRequest" | "catalogueToClassify" | "sobrusDone" | "sobrusFailed" | "storeStep";

export interface NotificationOut {
  id: number;
  kind: NotificationKind;
  /** The text's values, e.g. { n: 12 }, { store: "…", state: "en_cours" }. */
  params: Record<string, string | number>;
  /** The page it opens, after the user's role: "boutiques" → /support/boutiques. */
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface NotificationsOut {
  items: NotificationOut[];
  unread: number;
}
