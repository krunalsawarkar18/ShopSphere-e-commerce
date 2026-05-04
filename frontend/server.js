const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "public");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp"
};

function getCacheControl(filePath) {
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    return "public, max-age=86400";
  }

  if (path.extname(filePath).toLowerCase() === ".html") {
    return "no-cache";
  }

  return "public, max-age=3600";
}

function resolveFilePath(requestUrl) {
  const parsedPath = new URL(requestUrl, `http://localhost:${port}`).pathname;
  const safePath = path.normalize(parsedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(publicDir, safePath === path.sep ? "index.html" : safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!path.extname(filePath)) {
    filePath = `${filePath}.html`;
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  const filePath = resolveFilePath(req.url || "/");

  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": getCacheControl(filePath)
  });

  const fileStream = fs.createReadStream(filePath);

  fileStream.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Failed to load file");
  });

  fileStream.pipe(res);
});

server.listen(port, () => {
  console.log(`Frontend running on http://localhost:${port}`);
});
