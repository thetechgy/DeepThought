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

test("malformed table-of-contents hashes do not block later initializers", async ({ page }) => {
  const pageErrors = [];
  const scopedRequests = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.resourceType() === "script" && request.url().startsWith("https://")) {
      scopedRequests.push(request.url());
    }
  });
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.route(/\/docs\/extended-shortcodes\/$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      body: body.replace(
        /(<a[^>]+class="toc[^"]*"[^>]+href=")[^"]+(")/,
        "$1#%$2"
      ),
      response
    });
  });

  await page.goto("/docs/extended-shortcodes/");

  await expect(page.locator(".toc").first()).toHaveAttribute("href", "#%");
  expect(pageErrors).toEqual([]);
  expect(scopedRequests).toEqual(["https://deepthought-theme.disqus.com/embed.js"]);
  expect(await page.evaluate(() => typeof window.disqus_config)).toBe("function");
});

test("maps render features without optional GeoJSON properties", async ({ page }) => {
  await page.addInitScript(() => {
    window.__mapPopupContents = [];
    window.mapboxgl = {
      Map: class {
        addControl() {}

        setCenter() {}
      },
      Marker: class {
        setLngLat() {
          return this;
        }

        setPopup(popup) {
          this.popup = popup;
          return this;
        }

        addTo() {
          window.__mapPopupContents.push({
            description: this.popup.content.querySelector("p").textContent,
            title: this.popup.content.querySelector("h3").textContent
          });
          return this;
        }
      },
      NavigationControl: class {},
      Popup: class {
        setDOMContent(content) {
          this.content = content;
          return this;
        }
      }
    };
  });
  await page.route((url) => url.pathname === "/" && url.port === "4173", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const map = [
      '<div class="map" data-mapbox-token="test-token" data-zoom="6"',
      ' data-geojson=\'{"type":"FeatureCollection","features":[{"type":"Feature",',
      '"geometry":{"type":"Point","coordinates":[1,2]}}]}\'></div>'
    ].join("");
    await route.fulfill({
      body: body.replace("</body>", map + "</body>"),
      response
    });
  });

  await page.goto("/");

  await expect(page.locator(".map")).not.toHaveText("Map could not be rendered.");
  expect(await page.evaluate(() => window.__mapPopupContents)).toEqual([
    { description: "", title: "" }
  ]);
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
  const initialIcon = await toggle.locator("use").getAttribute("href");

  expect(initialIcon).toMatch(initialState === "true" ? /#sun$/ : /#moon$/);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", initialState === "true" ? "false" : "true");
  await expect(toggle.locator("use")).toHaveAttribute(
    "href",
    initialState === "true" ? /#moon$/ : /#sun$/
  );
  const selectedTheme = await page.locator("html").getAttribute("data-theme");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", selectedTheme);
  await expect(page.locator("#theme-toggle")).toHaveAttribute(
    "aria-pressed",
    selectedTheme === "dark" ? "true" : "false"
  );
  await expect(page.locator("#theme-toggle use")).toHaveAttribute(
    "href",
    selectedTheme === "dark" ? /#sun$/ : /#moon$/
  );
});

test("navigation controls and social links keep large targets without visible containers", async ({ page }) => {
  await page.goto("/");
  await revealNavigationControls(page);

  for (const selector of ["#nav-search", "#theme-toggle"]) {
    const control = page.locator(selector);
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box, selector + " should have a rendered bounding box").not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(control).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(control.locator(".dt-icon")).toHaveCSS("width", "18px");
    await expect(control.locator(".dt-icon")).toHaveCSS("height", "18px");
  }

  const socialLinks = page.locator(".social-link");
  expect(await socialLinks.count()).toBeGreaterThan(0);
  for (const socialLink of await socialLinks.all()) {
    await expect(socialLink).toBeVisible();
    const box = await socialLink.boundingBox();
    expect(box, "social link should have a rendered bounding box").not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(socialLink).toHaveCSS("border-top-width", "0px");
    await expect(socialLink.locator("svg")).toHaveCount(1);
  }
  await expect(page.locator(".social-link__mark")).toHaveCount(0);
});

test("layout separation uses whitespace instead of full-width rules", async ({ page }) => {
  await page.goto("/");
  await page.locator(".content").first().evaluate((content) => {
    content.insertAdjacentHTML("afterbegin", '<hr data-test-rule="true">');
  });

  await expect(page.locator(".navbar")).toHaveCSS("border-bottom-width", "0px");
  await expect(page.locator(".footer")).toHaveCSS("border-top-width", "0px");

  const rules = page.locator('.content hr[data-test-rule="true"]');
  for (const rule of await rules.all()) {
    await expect(rule).toHaveCSS("height", "0px");
    await expect(rule).toHaveCSS("border-top-width", "0px");
    await expect(rule).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
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
