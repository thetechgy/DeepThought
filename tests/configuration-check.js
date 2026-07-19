const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("an empty feed filename list omits the RSS link without failing the build", (t) => {
  const repositoryRoot = path.resolve(__dirname, "..");
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deepthought-config-"));
  const configPath = path.join(temporaryRoot, "config.toml");
  const outputPath = path.join(temporaryRoot, "public");
  const sourceConfig = fs.readFileSync(path.join(repositoryRoot, "config.toml"), "utf8");
  const emptyFeedConfig = sourceConfig.replace(
    /^feed_filenames\s*=\s*\[[^\n]*\]$/m,
    "feed_filenames = []"
  );

  t.after(() => fs.rmSync(temporaryRoot, { force: true, recursive: true }));
  assert.notEqual(emptyFeedConfig, sourceConfig, "config fixture must declare feed_filenames");
  fs.writeFileSync(configPath, emptyFeedConfig);

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

  const homepage = fs.readFileSync(path.join(outputPath, "index.html"), "utf8");
  assert.doesNotMatch(homepage, /title="RSS feed"/);
  assert.equal(fs.existsSync(path.join(outputPath, "rss.xml")), false);
});
