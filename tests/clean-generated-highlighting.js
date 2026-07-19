const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");

for (const filename of ["giallo-light.css", "giallo-dark.css"]) {
  fs.rmSync(path.join(repositoryRoot, "static", filename), { force: true });
}
