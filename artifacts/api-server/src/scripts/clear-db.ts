import { db, trades, performanceMatrix } from "@workspace/db";
await db.delete(performanceMatrix);
await db.delete(trades);
console.log("Cleared all trades and matrix rows");
