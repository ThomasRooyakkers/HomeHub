import { apiFetch, ApiError } from "./api";

describe("apiFetch", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("returns parsed JSON and includes credentials", async () => {
    const json = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json });

    await expect(apiFetch("/api/ping")).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith("/api/ping", { credentials: "include" });
  });

  test("throws ApiError with backend message", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: jest.fn().mockResolvedValue({ error: { message: "Admin only" } }),
    });

    await expect(apiFetch("/api/admin/stats")).rejects.toEqual(expect.any(ApiError));
    await expect(apiFetch("/api/admin/stats")).rejects.toMatchObject({ status: 403, message: "Admin only" });
  });
});
