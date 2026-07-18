const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..", "public");
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function resolveRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }
  let candidate = path.resolve(root, "." + pathname);

  if (!candidate.startsWith(root + path.sep) && candidate !== root) {
    return null;
  }
  if (pathname.endsWith("/")) {
    candidate = path.join(candidate, "index.html");
  } else if (!path.extname(candidate) && fs.existsSync(path.join(candidate, "index.html"))) {
    candidate = path.join(candidate, "index.html");
  }
  return candidate;
}

const server = http.createServer((request, response) => {
  const requestedPath = resolveRequestPath(request.url);
  if (!requestedPath || !fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[path.extname(requestedPath)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff"
  };
  const source = fs.createReadStream(requestedPath);
  const compressible = /^(text\/|application\/(json|javascript|xml))/.test(headers["Content-Type"]);
  if (compressible && /\bgzip\b/.test(request.headers["accept-encoding"] || "")) {
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
    response.writeHead(200, headers);
    source.pipe(zlib.createGzip()).pipe(response);
  } else {
    response.writeHead(200, headers);
    source.pipe(response);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("DeepThought test server listening on http://127.0.0.1:" + port);
});
