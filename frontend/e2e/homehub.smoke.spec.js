const { test, expect } = require("playwright/test");

test("login and core household workflows", async ({ page }) => {
  await page.route(/open-meteo\.com/, async (route) => {
    const url = route.request().url();
    if (url.includes("geocoding-api")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ results: [{ name: "Brussels", country: "Belgium", latitude: 50.85, longitude: 4.35 }] }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        current: { temperature_2m: 21, weathercode: 1 },
        daily: {
          temperature_2m_max: [24],
          temperature_2m_min: [16],
          sunrise: ["2026-06-30T05:30"],
          sunset: ["2026-06-30T22:00"],
        },
      }),
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "HomeHub" })).toBeVisible();
  await page.locator('input[autocomplete="username"]').fill(process.env.SMOKE_ADMIN_USERNAME || "admin");
  await page.locator('input[autocomplete="current-password"]').fill(process.env.SMOKE_ADMIN_PASSWORD || "secret123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/Good (morning|afternoon|evening),/)).toBeVisible();
  await expect(page.getByText("Bills to settle")).toBeVisible();

  await page.getByRole("button", { name: "Quick add" }).click();
  const quickAdd = page.getByRole("dialog").filter({ hasText: "Quick add" });
  await quickAdd.getByRole("button", { name: "Invoice" }).click();
  await quickAdd.locator('input[placeholder="e.g. Engie"]').fill("Smoke Utilities");
  await quickAdd.locator('input[placeholder="0.00"]').fill("123.45");
  await quickAdd.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Invoice added")).toBeVisible();

  await page.getByRole("button", { name: "Invoices" }).click();
  await expect(page.getByRole("heading", { name: "Invoice Tracker" })).toBeVisible();
  await expect(page.getByText("Smoke Utilities")).toBeVisible();

  await page.getByRole("button", { name: "Shopping" }).click();
  await expect(page.getByRole("heading", { name: "Shopping" })).toBeVisible();
  await page.getByRole("button", { name: "Add store" }).click();

  await page.getByPlaceholder("e.g. Colruyt").fill("Colruyt");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: /Colruyt/ })).toBeVisible();

  await page.locator('input[placeholder="Add to Colruyt..."]').fill("Milk");
  await page.locator('input[placeholder="Add to Colruyt..."]').press("Enter");
  await expect(page.getByText("Milk")).toBeVisible();

  await page.getByRole("button", { name: "Meals" }).click();
  await expect(page.getByRole("heading", { name: "Meals" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Cookbook/ })).toBeVisible();

  await page.getByRole("button", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  await page.getByRole("button", { name: "System" }).click();
  await expect(page.getByText("System stats")).toBeVisible();
  await expect(page.getByText("Upload storage")).toBeVisible();
});
