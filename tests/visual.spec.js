const { test, expect } = require("@playwright/test");

async function preparePage(page, theme, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("theme", selectedTheme);
  }, theme);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
}

for (const theme of ["light", "dark"]) {
  test("homepage " + theme + " desktop visual", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "One stable browser owns visual baselines");
    await preparePage(page, theme, { width: 1440, height: 900 });

    await expect(page).toHaveScreenshot("homepage-" + theme + "-desktop.png", {
      animations: "disabled",
      fullPage: true
    });
  });

  test("homepage " + theme + " mobile navigation visual", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "One stable browser owns visual baselines");
    await preparePage(page, theme, { width: 320, height: 800 });
    await page.locator("#nav-menu-toggle").click();

    await expect(page).toHaveScreenshot("homepage-" + theme + "-mobile-nav.png", {
      animations: "disabled",
      fullPage: true
    });
  });
}
