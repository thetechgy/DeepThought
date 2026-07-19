const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

const routes = [
  { name: "homepage", path: "/" },
  { name: "article", path: "/posts/post-0/" },
  { name: "resource section", path: "/docs/" },
  { name: "taxonomy", path: "/tags/" },
  { name: "not found", path: "/404.html" }
];

function firstSrcsetUrl(srcset) {
  return srcset.split(",", 1)[0].trim().split(/\s+/, 1)[0];
}

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
  const mastodonLink = page.locator('a[title="Mastodon"]');
  await expect(mastodonLink).toHaveAttribute("href", "https://mastodon.social/@RatanShreshtha");
  await expect(mastodonLink).toHaveAttribute("rel", /\bme\b/);
});

test("fonts and icons are self-hosted and social links use recognizable SVG symbols", async ({ page }) => {
  const externalAssets = [];
  const expectedOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173"
  ).origin;
  page.on("request", (request) => {
    if (
      ["font", "stylesheet"].includes(request.resourceType()) &&
      new URL(request.url()).origin !== expectedOrigin
    ) {
      externalAssets.push(request.url());
    }
  });

  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  expect(externalAssets).toEqual([]);
  await expect(page.locator('link[href*="fonts.googleapis.com"]')).toHaveCount(0);
  await expect(page.locator('link[href*="fontawesome"]')).toHaveCount(0);
  await expect(page.locator('link[href*="academicons"]')).toHaveCount(0);

  const socialIcons = [
    {
      locator: page.locator('.social-link[title="LinkedIn"] use'),
      symbol: "brand-linkedin"
    },
    {
      locator: page.locator('.social-link[title="GitHub"] use'),
      symbol: "brand-github"
    }
  ];

  for (const socialIcon of socialIcons) {
    const href = await socialIcon.locator.getAttribute("href");
    expect(href).not.toBeNull();
    const resolvedHref = new URL(href, page.url());
    expect(resolvedHref.origin).toBe(expectedOrigin);
    expect(resolvedHref.hash).toBe("#" + socialIcon.symbol);
  }
});

test("taxonomy headings use plural symbols and taxonomy links use singular symbols", async ({ page }) => {
  const cases = [
    {
      path: "/categories/",
      headingSymbol: "categories",
      itemSymbol: "category",
      headingAspectRatio: 1.125
    },
    {
      path: "/tags/",
      headingSymbol: "tags",
      itemSymbol: "tag",
      headingAspectRatio: 1
    }
  ];

  for (const taxonomyCase of cases) {
    await page.goto(taxonomyCase.path);
    const heading = page.locator("h1.taxonomy-title");
    const itemIcon = page.locator("main p a .dt-icon").first();

    await expect(heading.locator("use")).toHaveAttribute(
      "href",
      new RegExp("#" + taxonomyCase.headingSymbol + "$")
    );
    await expect(itemIcon.locator("use")).toHaveAttribute(
      "href",
      new RegExp("#" + taxonomyCase.itemSymbol + "$")
    );

    const dimensions = await heading.evaluate((headingElement) => {
      const headingSvg = headingElement.querySelector(".taxonomy-title__icon .dt-icon");
      const itemSvg = document.querySelector("main p a .dt-icon");
      const headingBox = headingSvg.getBoundingClientRect();
      const itemBox = itemSvg.getBoundingClientRect();

      return {
        fontSize: Number.parseFloat(getComputedStyle(headingElement).fontSize),
        headingHeight: headingBox.height,
        headingWidth: headingBox.width,
        itemHeight: itemBox.height,
        itemWidth: itemBox.width
      };
    });

    expect(dimensions.headingHeight / dimensions.fontSize).toBeCloseTo(1, 2);
    expect(dimensions.headingWidth / dimensions.fontSize).toBeCloseTo(
      taxonomyCase.headingAspectRatio,
      2
    );
    expect(dimensions.itemHeight).toBeCloseTo(18, 1);
    expect(dimensions.itemWidth).toBeCloseTo(18, 1);
  }
});

test("article listings keep concise visible labels with descriptive accessible names", async ({ page }) => {
  const routes = ["/posts/"];

  for (const taxonomyPath of ["/categories/", "/tags/"]) {
    await page.goto(taxonomyPath);
    const route = await page.locator("main p a").first().getAttribute("href");
    expect(route).not.toBeNull();
    routes.push(route);
  }

  for (const route of routes) {
    await page.goto(route);
    const article = page.locator("article.box").first();
    const title = (await article.locator("h2").textContent()).trim();
    const readMore = article.locator(".read-more-link");

    await expect(readMore).toHaveAccessibleName("Read More about " + title);
    expect(await readMore.evaluate((link) => (
      Array.from(link.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .join(" ")
    ))).toBe("Read More");
  }
});

test("generated assets and feeds are served with accurate MIME types", async ({ page, request }) => {
  await page.goto("/");

  const imageCases = [
    { selector: 'source[type="image/avif"]', contentType: "image/avif" },
    { selector: 'source[type="image/webp"]', contentType: "image/webp" }
  ];

  for (const imageCase of imageCases) {
    const srcset = await page.locator(imageCase.selector).first().getAttribute("srcset");
    const response = await request.get(firstSrcsetUrl(srcset));

    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toBe(imageCase.contentType);
  }

  const feedResponse = await request.get("/rss.xml");
  expect(feedResponse.ok()).toBeTruthy();
  expect(feedResponse.headers()["content-type"]).toBe("application/xml; charset=utf-8");
});

test("responsive pictures retain portable resized fallbacks", async ({ page, request }) => {
  const cases = [
    { path: "/", selector: ".author-avatar" },
    { path: "/docs/welcome-to-deep-thought/", selector: ".responsive-image img" }
  ];

  for (const imageCase of cases) {
    await page.goto(imageCase.path);
    const image = page.locator(imageCase.selector).first();
    const picture = image.locator("xpath=ancestor::picture");
    const src = await image.getAttribute("src");
    const srcset = await image.getAttribute("srcset");

    expect(src).toMatch(/\.(?:jpe?g|png)$/);
    expect(srcset).toMatch(/\.(?:jpe?g|png)\s+\d+w/);
    await expect(picture.locator('source[type="image/avif"]')).toHaveCount(1);
    await expect(picture.locator('source[type="image/webp"]')).toHaveCount(1);

    const response = await request.get(src);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toMatch(/^image\/(?:jpeg|png)$/);
  }
});

test("gallery images expose accessible names and intrinsic dimensions", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.Galleria = { run() {} };
  });
  await page.route(/\/docs\/extended-shortcodes\/$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const fixture = '<div class="galleria" data-test-gallery="missing-alt" ' +
      'data-images="{&quot;images&quot;:[{&quot;src&quot;:&quot;/icons/favicon-32x32.png&quot;}]}"></div>';
    await route.fulfill({
      body: body.replace("</body>", fixture + "</body>"),
      response
    });
  });
  await page.goto("/docs/extended-shortcodes/");

  const images = page.locator(".extended-visual .galleria img");
  await expect(images).toHaveCount(8);
  for (const image of await images.all()) {
    await expect(image).toHaveAttribute("alt", /\S+/);
    await expect(image).toHaveAttribute("width", /^[1-9]\d*$/);
    await expect(image).toHaveAttribute("height", /^[1-9]\d*$/);
  }
  await expect(page.locator('[data-test-gallery="missing-alt"] img')).toHaveAttribute("alt", "");
  expect(pageErrors).toEqual([]);
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
