import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "artifacts", "liquidity-hunter", "dist", "public");
const port = parseInt(process.env.PORT || "3000", 10);

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

http.createServer((req, res) => {
  let filePath = path.join(root, req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback — serve index.html for unknown routes
      fs.readFile(path.join(root, "index.html"), (err2, data2) => {
        if (err2) { res.writeHead(500); res.end("500"); return; }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Serving SPA on http://0.0.0.0:${port}`);
});
