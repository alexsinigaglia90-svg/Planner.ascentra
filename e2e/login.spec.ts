import { test, expect } from "@playwright/test";

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Planner/i);
});

test("login with valid credentials", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/email/i).fill("admin@default.local");
  await page.getByLabel(/password/i).fill("admin123");
  await page.getByRole("button", { name: /log in|sign in/i }).click();

  await expect(page).toHaveURL(/dashboard|planning/, { timeout: 10000 });
});
