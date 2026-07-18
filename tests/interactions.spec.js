const { test, expect } = require("@playwright/test");

async function revealNavigationControls(page) {
  const search = page.locator("#nav-search");
  if (!(await search.isVisible())) {
    await page.locator("#nav-menu-toggle").click();
    await expect(search).toBeVisible();
  }
}

test("skip link is first and moves focus to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("mobile navigation exposes and updates expanded state", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const toggle = page.locator("#nav-menu-toggle");
  const menu = page.locator("#navMenu");

  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toHaveClass(/is-active/);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("search dialog announces results and restores focus after Escape", async ({ page }) => {
  await page.goto("/");
  await revealNavigationControls(page);
  const trigger = page.locator("#nav-search");
  const dialog = page.locator("#search-dialog");
  const input = page.locator("#search");

  await trigger.click();
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(input).toBeFocused();
  await expect(page.locator("#search-status")).toContainText("Enter a search term");

  await input.fill("DeepThought");
  await expect(page.locator("#search-status")).toContainText(/results? found/);
  await expect(page.locator("#search-results > li").first()).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toHaveJSProperty("open", true);
  await expect(trigger).toBeFocused();
});

test("theme toggle publishes its pressed state and survives reload", async ({ page }) => {
  await page.goto("/");
  await revealNavigationControls(page);
  const toggle = page.locator("#theme-toggle");
  const initialState = await toggle.getAttribute("aria-pressed");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", initialState === "true" ? "false" : "true");
  const selectedTheme = await page.locator("html").getAttribute("data-theme");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selectedTheme);
  await expect(page.locator("#theme-toggle")).toHaveAttribute(
    "aria-pressed",
    selectedTheme === "dark" ? "true" : "false"
  );
});

test("forced-colors and reduced-motion preferences retain operable controls", async ({ browser }) => {
  const context = await browser.newContext({
    forcedColors: "active",
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await revealNavigationControls(page);

  await expect(page.locator("#nav-search")).toBeVisible();
  await expect(page.locator("#theme-toggle")).toBeVisible();
  await expect(page.locator(".skip-link")).toHaveCSS("transition-duration", "0s");
  await context.close();
});
