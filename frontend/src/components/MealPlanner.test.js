import { parseIngredients } from "./MealPlanner";

describe("parseIngredients", () => {
  test("prefers one ingredient per non-empty line", () => {
    expect(parseIngredients("Pasta\n\nTomatoes\n Garlic ")).toEqual([
      "Pasta",
      "Tomatoes",
      "Garlic",
    ]);
  });

  test("falls back to comma-separated ingredients for single-line recipes", () => {
    expect(parseIngredients("Milk, eggs, flour,, sugar ")).toEqual([
      "Milk",
      "eggs",
      "flour",
      "sugar",
    ]);
  });

  test("returns an empty list for blank input", () => {
    expect(parseIngredients("   ")).toEqual([]);
    expect(parseIngredients(null)).toEqual([]);
  });
});
