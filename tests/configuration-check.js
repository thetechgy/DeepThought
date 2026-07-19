const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

const repositoryRoot = path.resolve(__dirname, "..");

function buildWithConfig(t, transformConfig = null) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deepthought-config-"));
  const configPath = path.join(temporaryRoot, "config.toml");
  const outputPath = path.join(temporaryRoot, "public");
  const highlightingPath = path.join(temporaryRoot, "highlight_themes");
  const sourceConfig = fs.readFileSync(path.join(repositoryRoot, "config.toml"), "utf8");
  const variantConfig = transformConfig ? transformConfig(sourceConfig) : sourceConfig;

  t.after(() => fs.rmSync(temporaryRoot, { force: true, recursive: true }));
  if (transformConfig) {
    assert.notEqual(variantConfig, sourceConfig, "config transform must change the fixture");
  }
  fs.cpSync(path.join(repositoryRoot, "highlight_themes"), highlightingPath, {
    recursive: true
  });
  fs.writeFileSync(configPath, variantConfig);

  const result = spawnSync(process.env.ZOLA_BIN || "zola", [
    "--root",
    repositoryRoot,
    "--config",
    configPath,
    "build",
    "--output-dir",
    outputPath,
    "--force"
  ], { encoding: "utf8" });

  assert.equal(
    result.status,
    0,
    [result.error?.message, result.stdout, result.stderr].filter(Boolean).join("\n")
  );

  return outputPath;
}

test("the core stylesheet stays within its render-blocking transfer budget", (t) => {
  const outputPath = buildWithConfig(t);
  const stylesheet = fs.readFileSync(path.join(outputPath, "deep-thought.css"));
  const gzipBytes = zlib.gzipSync(stylesheet).byteLength;

  assert.ok(
    stylesheet.byteLength <= 120_000,
    `deep-thought.css is ${stylesheet.byteLength} bytes; expected at most 120000`
  );
  assert.ok(
    gzipBytes <= 18_500,
    `deep-thought.css is ${gzipBytes} gzip bytes; expected at most 18500`
  );
});

test("an empty feed filename list omits the RSS link without failing the build", (t) => {
  const outputPath = buildWithConfig(t, (sourceConfig) => sourceConfig.replace(
    /^feed_filenames\s*=\s*\[[^\n]*\]$/m,
    "feed_filenames = []"
  ));
  const homepage = fs.readFileSync(path.join(outputPath, "index.html"), "utf8");
  assert.doesNotMatch(homepage, /title="RSS feed"/);
  assert.equal(fs.existsSync(path.join(outputPath, "rss.xml")), false);
});

test("KaTeX uses the shortcode and auto-render integrations without the legacy script adapter", (t) => {
  const outputPath = buildWithConfig(t, (sourceConfig) => sourceConfig.replace(
    /^katex\.enabled = false$/m,
    "katex.enabled = true"
  ));
  const shortcodePage = fs.readFileSync(
    path.join(outputPath, "docs", "extended-shortcodes", "index.html"),
    "utf8"
  );

  assert.match(shortcodePage, /katex@0\.15\.1\/dist\/katex\.min\.js/);
  assert.match(shortcodePage, /contrib\/auto-render\.min\.js/);
  assert.match(shortcodePage, /data-katex=/);
  assert.doesNotMatch(shortcodePage, /contrib\/mathtex-script-type\.min\.js/);
});

test("theme defaults apply before JavaScript and select matching highlighting", (t) => {
  const cases = [
    {
      configured: "light",
      expectedDefault: "light",
      expectedTheme: "light",
      lightMedia: "all",
      darkMedia: "not all"
    },
    {
      configured: "dark",
      expectedDefault: "dark",
      expectedTheme: "dark",
      lightMedia: "not all",
      darkMedia: "all"
    },
    {
      configured: "sepia",
      expectedDefault: "system",
      expectedTheme: null,
      lightMedia: "(prefers-color-scheme: light)",
      darkMedia: "(prefers-color-scheme: dark)"
    }
  ];

  for (const themeCase of cases) {
    const outputPath = buildWithConfig(t, (sourceConfig) => sourceConfig.replace(
      /^default = "system"$/m,
      `default = "${themeCase.configured}"`
    ));
    const homepage = fs.readFileSync(path.join(outputPath, "index.html"), "utf8");
    const htmlTag = homepage.match(/<html[^>]*>/)?.[0];
    const lightMedia = homepage.match(
      /<link id="giallo-light"[^>]*\bmedia="([^"]+)"/
    )?.[1];
    const darkMedia = homepage.match(
      /<link id="giallo-dark"[^>]*\bmedia="([^"]+)"/
    )?.[1];

    assert.ok(htmlTag, "generated homepage must include an html element");
    assert.match(htmlTag, new RegExp(`data-theme-default="${themeCase.expectedDefault}"`));
    if (themeCase.expectedTheme) {
      assert.match(htmlTag, new RegExp(` data-theme="${themeCase.expectedTheme}"`));
    } else {
      assert.doesNotMatch(htmlTag, / data-theme="/);
    }
    assert.equal(lightMedia, themeCase.lightMedia);
    assert.equal(darkMedia, themeCase.darkMedia);
  }
});

test("GitHub Colorblind themes generate the expected light and dark CSS", (t) => {
  const outputPath = buildWithConfig(t, (sourceConfig) => sourceConfig.replace(
    /^default = "system"$/m,
    'default = "light"'
  ));
  const lightTheme = fs.readFileSync(path.join(outputPath, "giallo-light.css"), "utf8");
  const darkTheme = fs.readFileSync(path.join(outputPath, "giallo-dark.css"), "utf8");

  assert.match(lightTheme, /theme "GitHub Light Colorblind" generated by giallo/);
  assert.match(lightTheme, /\.z-keyword \{ color: #B35900; \}/);
  assert.match(lightTheme, /\.z-code \{\s+color: #24292F;\s+background-color: #FFFFFF;/);
  assert.match(darkTheme, /theme "GitHub Dark Colorblind" generated by giallo/);
  assert.match(darkTheme, /\.z-keyword \{ color: #EC8E2C; \}/);
  assert.match(darkTheme, /\.z-code \{\s+color: #C9D1D9;\s+background-color: #0D1117;/);
});
