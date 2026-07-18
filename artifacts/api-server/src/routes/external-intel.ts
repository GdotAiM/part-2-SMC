/**
 * External Intelligence Routes — manual trigger for economic calendar refresh.
 *
 * This file is NOT wired into routes/index.ts yet — it's a standalone
 * trigger endpoint for the economic calendar refresh job. Wire it in by
 * adding to routes/index.ts when ready:
 *
 *   import externalIntelRouter from "./external-intel.js";
 *   router.use(externalIntelRouter);
 *
 * GET  /api/external-intel/refresh  → run the full refresh pipeline and
 *                                     return a summary result.
 *
 * The endpoint requires FIRECRAWL_API_KEY and SCRAPEGRAPH_API_KEY to be
 * set in the environment. If they are missing, the endpoint still works
 * and returns the error message from the job result.
 */

import { Router, type IRouter } from "express";
import { refreshEconomicCalendar } from "../lib/external-intel/refresh-job.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.get("/external-intel/refresh", async (_req, res): Promise<void> => {
  logger.info("Manual trigger: economic calendar refresh");

  try {
    const result = await refreshEconomicCalendar();
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "External intel refresh route error");
    res.status(500).json({ error: message });
  }
});

export default router;
