import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "artifacts", "liquidity-hunter", "dist", "public");
const port = parseInt(process.env.PORT || "3000", 10);
const apiTarget = process.env.API_TARGET || "http://localhost:3001";

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

/** Proxy an API request to the backend server. */
function proxyApi(req, res) {
  const options = {
    hostname: new URL(apiTarget).hostname,
    port: new URL(apiTarget).port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers },
  };

  // Don't forward the Host header from the original request
  delete options.headers.host;

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `API proxy error: ${err.message}` }));
  });

  req.pipe(proxyReq);
}

http.createServer((req, res) => {
  // Proxy /api and /api/* requests to the backend
  if (req.url.startsWith("/api")) {
    return proxyApi(req, res);
  }

  // Static files
  let filePath = path.join(root, req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);

  const headers = { "Cache-Control": "no-cache, no-store, must-revalidate" };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback — serve index.html for unknown routes (client-side routing)
      fs.readFile(path.join(root, "index.html"), (err2, data2) => {
        if (err2) { res.writeHead(500); res.end("500"); return; }
        res.writeHead(200, { ...headers, "Content-Type": "text/html" });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { ...headers, "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Serving SPA on http://0.0.0.0:${port}`);
  console.log(`Proxying /api/* -> ${apiTarget}`);
});
