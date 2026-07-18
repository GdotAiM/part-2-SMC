import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import symbolsRouter from "./symbols.js";
import analysisRouter from "./analysis.js";
import agentsRouter from "./agents.js";
import streamRouter from "./stream.js";
import agentsMcpRouter from "./agents-mcp.js";
import ledgerRouter from "./ledger.js";
import agentLoopRouter from "./agent-loop.js";
import learningRouter from "./learning.js";
import strategiesRouter from "./strategies.js";
import externalIntelRouter from "./external-intel.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(symbolsRouter);
router.use(analysisRouter);
router.use(agentsRouter);
router.use(streamRouter);
router.use(agentsMcpRouter);
router.use(ledgerRouter);
router.use(agentLoopRouter);
router.use("/learning", learningRouter);
router.use(strategiesRouter);
router.use(externalIntelRouter);

export default router;
