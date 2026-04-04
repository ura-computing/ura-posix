import { describe, it, expect, beforeEach } from "vitest";
import {
  getToken,
  setToken,
  clearToken,
  getNotifications,
  addNotification,
  dismissNotification,
  markAllRead,
  type ApcmNotification,
} from "../../lib/storage";

// Helper to reset chrome.storage.local between tests
function resetStorage() {
  // Clear all keys by removing them through the mock
  chrome.storage.local.remove(["apcm_token", "apcm_notifications"]);
}

describe("Token helpers", () => {
  beforeEach(() => {
    resetStorage();
  });

  it("getToken returns null when no token is stored", async () => {
    const token = await getToken();
    expect(token).toBeNull();
  });

  it("setToken stores a token and getToken retrieves it", async () => {
    await setToken("my-jwt-token");
    const token = await getToken();
    expect(token).toBe("my-jwt-token");
  });

  it("clearToken removes the stored token", async () => {
    await setToken("my-jwt-token");
    await clearToken();
    const token = await getToken();
    expect(token).toBeNull();
  });

  it("setToken overwrites an existing token", async () => {
    await setToken("token-1");
    await setToken("token-2");
    const token = await getToken();
    expect(token).toBe("token-2");
  });
});

describe("Notification helpers", () => {
  beforeEach(() => {
    resetStorage();
  });

  const makeNotification = (overrides: Partial<ApcmNotification> = {}): ApcmNotification => ({
    id: "n-1",
    fileType: "vente",
    inserted: 10,
    skipped: 2,
    timestamp: Date.now(),
    read: false,
    ...overrides,
  });

  it("getNotifications returns an empty array when none exist", async () => {
    const notifications = await getNotifications();
    expect(notifications).toEqual([]);
  });

  it("addNotification adds a notification to the front of the list", async () => {
    const n1 = makeNotification({ id: "n-1" });
    const n2 = makeNotification({ id: "n-2" });

    await addNotification(n1);
    await addNotification(n2);

    const notifications = await getNotifications();
    expect(notifications).toHaveLength(2);
    expect(notifications[0].id).toBe("n-2");
    expect(notifications[1].id).toBe("n-1");
  });

  it("dismissNotification removes a notification by id", async () => {
    const n1 = makeNotification({ id: "n-1" });
    const n2 = makeNotification({ id: "n-2" });

    await addNotification(n1);
    await addNotification(n2);
    await dismissNotification("n-1");

    const notifications = await getNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe("n-2");
  });

  it("dismissNotification does nothing if id is not found", async () => {
    const n1 = makeNotification({ id: "n-1" });
    await addNotification(n1);
    await dismissNotification("non-existent");

    const notifications = await getNotifications();
    expect(notifications).toHaveLength(1);
  });

  it("markAllRead sets read to true on all notifications", async () => {
    const n1 = makeNotification({ id: "n-1", read: false });
    const n2 = makeNotification({ id: "n-2", read: false });

    await addNotification(n1);
    await addNotification(n2);
    await markAllRead();

    const notifications = await getNotifications();
    expect(notifications.every((n) => n.read)).toBe(true);
  });

  it("markAllRead does nothing on an empty list", async () => {
    await markAllRead();
    const notifications = await getNotifications();
    expect(notifications).toEqual([]);
  });
});
