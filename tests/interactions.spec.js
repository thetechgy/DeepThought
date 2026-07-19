const http = require("node:http");
const { test, expect } = require("@playwright/test");

function requestRawPath(requestPath) {
  return new Promise((resolve, reject) => {
    const rawRequest = http.request({
      hostname: "127.0.0.1",
      method: "GET",
      path: requestPath,
      port: 4173
    }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    rawRequest.on("error", reject);
    rawRequest.end();
  });
}

async function revealNavigationControls(page) {
  const search = page.locator("#nav-search");
  if (!(await search.isVisible())) {
    await page.locator("#nav-menu-toggle").click();
    await expect(search).toBeVisible();
  }
}

test("test server rejects malformed paths without terminating", async ({ request }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), "Only applies to the local test server");

  expect(await requestRawPath("/%%")).toBe(404);
  expect((await request.get("/")).ok()).toBeTruthy();
});

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

test("navigation treats trailing-slash variants as the current page", async ({ page }) => {
  for (const path of ["/tags", "/tags/"]) {
    await page.goto(path);
    const tagsLink = page.locator("#navMenu a.navbar-item", { hasText: "Tags" });
    await tagsLink.evaluate((link) => {
      link.href = "/tags/";
      link.classList.remove("is-active");
      link.removeAttribute("aria-current");
    });
    await page.addScriptTag({ url: "/js/site.js?trailing-slash-regression" });
    await expect(tagsLink).toHaveAttribute("aria-current", "page");
  }
});

test("comments load only from validated Disqus configuration", async ({ browser }) => {
  const context = await browser.newContext();
  const scopedPage = await context.newPage();
  const scopedRequests = [];

  scopedPage.on("request", (request) => {
    if (request.resourceType() === "script" && request.url().startsWith("https://")) {
      scopedRequests.push(request.url());
    }
  });
  await scopedPage.route(/^https:\/\//, (route) => route.abort());
  await scopedPage.route(/\/docs\/extended-shortcodes\/$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const forgedContainer = '<div data-disqus-shortname="attacker.example/path?"></div>';
    await route.fulfill({
      body: body.replace("<body>", "<body>" + forgedContainer),
      response
    });
  });

  await scopedPage.goto("http://127.0.0.1:4173/docs/extended-shortcodes/");
  expect(scopedRequests).toEqual(["https://deepthought-theme.disqus.com/embed.js"]);

  const invalidPage = await context.newPage();
  const invalidRequests = [];
  invalidPage.on("request", (request) => {
    if (request.resourceType() === "script" && request.url().startsWith("https://")) {
      invalidRequests.push(request.url());
    }
  });
  await invalidPage.route(/^https:\/\//, (route) => route.abort());
  await invalidPage.route(/\/docs\/extended-shortcodes\/$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      body: body.replace(
        'data-disqus-shortname="deepthought-theme"',
        'data-disqus-shortname="attacker.example/path?"'
      ),
      response
    });
  });

  await invalidPage.goto("http://127.0.0.1:4173/docs/extended-shortcodes/");
  expect(invalidRequests).toEqual([]);
  expect(await invalidPage.evaluate(() => typeof window.disqus_config)).toBe("undefined");
  await context.close();
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
