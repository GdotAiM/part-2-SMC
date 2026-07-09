import express, { type Express } from "express";
import compression from "compression";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// gzip/brotli-compress all responses. Placed high in the stack (before the
// router) so every JSON payload — analysis, ledger, performance matrix — is
// compressed on the wire. Threshold keeps tiny responses (healthz, acks) from
// paying the compression overhead. The filter skips Server-Sent Events
// (text/event-stream) — compressing those buffers the response and breaks
// real-time token deltas on the /agents and /stream SSE endpoints.
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      const contentType = String(res.getHeader("Content-Type") ?? "");
      if (contentType.includes("text/event-stream")) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS — controlled by CORS_ORIGINS env var (comma-separated allowlist,
// "*" for any origin).  Defaults to wide-open for development; restrict
// in production.
const corsOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin:
      corsOrigins.length === 0 || corsOrigins[0] === "*"
        ? "*"
        : corsOrigins,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
