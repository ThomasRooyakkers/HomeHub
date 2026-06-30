import { buildSearchIndex } from "./GlobalSearch";

describe("buildSearchIndex", () => {
  const data = {
    invoices: [
      { id: 1, vendor: "Engie", invoiceNo: "ENG-42", category: "Utilities", notes: "electricity", status: "unpaid" },
    ],
    documents: [
      { id: 2, title: "Boiler warranty", category: "Warranty", originalName: "boiler.pdf" },
    ],
    contacts: [
      { id: 3, name: "Alex Plumber", company: "Pipe Co", phone: "555-0100" },
    ],
    inventory: [
      { id: 4, name: "Washing machine", brand: "Miele", serialNo: "WM-1", location: "Laundry" },
    ],
    recipes: [
      { id: 5, name: "Pasta puttanesca", category: "Pasta", ingredients: "Capers\nOlives", instructions: "Simmer sauce" },
    ],
    tasks: {
      items: [{ id: 6, title: "Put bins out", type: "weekday", weekdays: [1] }],
    },
    maintenanceTasks: [
      { id: 7, title: "Check smoke detectors", frequency: "monthly", nextDue: "2026-07-01" },
    ],
    calendarEvents: [
      { uid: "event-1", title: "School pickup", location: "Gate", start: "2026-07-01T15:00:00Z" },
    ],
  };

  test("indexes searchable household data across enabled modules", () => {
    const index = buildSearchIndex(data);

    expect(index.map((result) => result.title)).toEqual(expect.arrayContaining([
      "Engie",
      "Boiler warranty",
      "Alex Plumber",
      "Washing machine",
      "Pasta puttanesca",
      "Put bins out",
      "Check smoke detectors",
      "School pickup",
    ]));
    expect(index.find((result) => result.title === "Pasta puttanesca").haystack).toContain("capers");
    expect(index.find((result) => result.title === "Engie").subtitle).toContain("#ENG-42");
  });

  test("omits disabled feature modules", () => {
    const index = buildSearchIndex(data, { invoices: false, meal: false });

    expect(index.some((result) => result.module === "invoices")).toBe(false);
    expect(index.some((result) => result.module === "meal")).toBe(false);
    expect(index.some((result) => result.module === "documents")).toBe(true);
  });
});
