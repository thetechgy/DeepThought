const { test, expect } = require("@playwright/test");

async function preparePage(page, theme, path = "/") {
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("theme", selectedTheme);
  }, theme);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

for (const theme of ["light", "dark"]) {
  test("homepage " + theme + " desktop visual", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The desktop project owns desktop baselines");
    await page.setViewportSize({ width: 1440, height: 900 });
    await preparePage(page, theme);

    await expect(page).toHaveScreenshot("homepage-" + theme + "-desktop.png", {
      animations: "disabled",
      fullPage: true
    });
  });

  test("homepage " + theme + " mobile navigation visual", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "The mobile project owns mobile baselines"
    );
    await preparePage(page, theme);
    await page.locator("#nav-menu-toggle").click();

    await expect(page).toHaveScreenshot("homepage-" + theme + "-mobile-nav.png", {
      animations: "disabled",
      fullPage: true
    });
  });

  test("syntax highlighting " + theme + " visual", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "The desktop project owns code baselines");
    await page.setViewportSize({ width: 1200, height: 800 });
    await preparePage(page, theme, "/docs/welcome-to-deep-thought/");

    await expect(page.locator("pre.giallo").first()).toHaveScreenshot(
      "syntax-highlighting-" + theme + ".png",
      { animations: "disabled" }
    );
  });
}
