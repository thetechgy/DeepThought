const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const routes = [
  { name: "homepage", path: "/" },
  { name: "article", path: "/posts/post-0/" },
  { name: "resource section", path: "/docs/" },
  { name: "taxonomy", path: "/tags/" },
  { name: "not found", path: "/404.html" }
];

for (const route of routes) {
  test(route.name + " has no detectable WCAG A or AA violations", async ({ page }) => {
    await page.goto(route.path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test(route.name + " has a semantic document outline and metadata", async ({ page }) => {
    await page.goto(route.path);

    await expect(page.locator("html")).toHaveAttribute("lang", /\S+/);
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /\S+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\//);
    await expect(page.locator("script:not([src])")).toHaveCount(0);
    await expect(page.locator("[style]")).toHaveCount(0);
  });
}

test("images and new-tab links expose complete accessible contracts", async ({ page }) => {
  await page.goto("/");

  for (const image of await page.locator("img").all()) {
    await expect(image).toHaveAttribute("alt");
    await expect(image).toHaveAttribute("width", /^[1-9]\d*$/);
    await expect(image).toHaveAttribute("height", /^[1-9]\d*$/);
  }

  for (const link of await page.locator('a[target="_blank"]').all()) {
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);
  }
});

test("the page reflows at 320 CSS pixels with text-spacing overrides", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/posts/post-0/");
  await page.addStyleTag({
    content: `
      * {
        letter-spacing: 0.12em !important;
        line-height: 1.5 !important;
        word-spacing: 0.16em !important;
      }
      p { margin-bottom: 2em !important; }
    `
  });

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
