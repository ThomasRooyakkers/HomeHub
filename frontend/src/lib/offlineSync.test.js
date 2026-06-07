import {
  cacheUserProfile,
  clearCachedUserProfile,
  enqueueSync,
  loadCachedUserProfile,
  loadSyncQueue,
  replaySyncQueue,
} from "./offlineSync";

describe("offlineSync", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test("stores only a safe cached user profile", () => {
    cacheUserProfile({ id: "u1", username: "thomas", role: "admin", passwordHash: "secret" });
    expect(loadCachedUserProfile()).toEqual({ id: "u1", username: "thomas", role: "admin" });
    clearCachedUserProfile();
    expect(loadCachedUserProfile()).toBeNull();
  });

  test("enqueues JSON mutations with trace metadata", () => {
    enqueueSync({ method: "PUT", endpoint: "/api/meal-plan", body: { today: "Pasta" }, resource: "mealPlan" });
    expect(loadSyncQueue()).toMatchObject([
      { method: "PUT", endpoint: "/api/meal-plan", body: { today: "Pasta" }, resource: "mealPlan" },
    ]);
  });

  test("replays in order and preserves failed entries", async () => {
    enqueueSync({ method: "POST", endpoint: "/api/one", body: { a: 1 }, resource: "one" });
    enqueueSync({ method: "POST", endpoint: "/api/two", body: { b: 2 }, resource: "two" });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const remaining = await replaySyncQueue();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ endpoint: "/api/two", resource: "two" });
  });
});
