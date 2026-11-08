import { test, expect } from "@playwright/test";

/**
 * Login flow e2e tests.
 *
 * NOTE: Tests are skipped because the app requires a running dev server
 * (npm run dev) and the backend auth services are not yet fully wired.
 * These tests will pass once:
 * 1. The dev server is running on http://localhost:3000
 * 2. The auth API routes are implemented
 * 3. The login/signup UI pages are created
 */

test.describe("Login flow", () => {
  test.skip("signs up a new user and logs in", async ({ page }) => {
    // Mock API for signup and login
    await page.route("**/api/auth/**", async (route) => {
      if (route.request().url().includes("callback")) {
        await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ user: { name: "Test User" } }) });
      }
    });

    await page.goto("/");

    // Navigate to login/signup
    await page.getByRole("link", { name: /sign up|register|login/i }).click();
    await expect(page).toHaveURL(/\/auth/);

    // Fill signup form
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await emailInput.fill("testuser@example.com");
    await passwordInput.fill("TestPassword123!");

    await page.getByRole("button", { name: /sign up|register|create/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/welcome|testuser/i)).toBeVisible({ timeout: 5000 });
  });

  test.skip("converts a guest session to a registered account", async ({ page }) => {
    await page.route("**/api/auth/**", async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.goto("/");

    // Guest should see lobby directly
    await expect(page.getByText(/guest/i)).toBeVisible({ timeout: 3000 });

    // Find upgrade/convert button and click
    const convertButton = page.getByRole("button", { name: /convert|upgrade|sign up/i }).first();
    await convertButton.click();

    // Fill conversion form
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await emailInput.fill("guestupgrade@example.com");
    await passwordInput.fill("NewPassword123!");

    await page.getByRole("button", { name: /convert|upgrade|register/i }).click();

    // Should show registered status
    await expect(page.getByText(/registered|account created/i)).toBeVisible({ timeout: 5000 });
  });
});
