import { dateKey, displayStatus, getWeekDays } from "./utils";

describe("utils", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-06T10:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("dateKey formats ISO calendar dates", () => {
    expect(dateKey("2026-06-06T12:34:00Z")).toBe("2026-06-06");
  });

  test("getWeekDays starts today and includes six following days", () => {
    const days = getWeekDays();
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ key: "2026-06-06", isToday: true });
    expect(days[6].key).toBe("2026-06-12");
  });

  test("displayStatus marks unpaid past invoices overdue", () => {
    expect(displayStatus({ dueDate: "2026-06-05", status: "unpaid" })).toBe("overdue");
    expect(displayStatus({ dueDate: "2026-06-05", status: "paid" })).toBe("paid");
  });
});
