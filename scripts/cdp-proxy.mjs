/**
 * CDP Proxy — TCP forwarder for TradingView Desktop's Chrome DevTools Protocol.
 *
 * Why this exists:
 *   On Windows, Microsoft Edge (and Chrome) bind the remote-debugging port to
 *   127.0.0.1 only — the --remote-debugging-address=0.0.0.0 flag is silently
 *   ignored by Edge.  Docker containers cannot reach 127.0.0.1 on the host.
 *
 *   This proxy listens on 0.0.0.0:29222 and forwards every connection to
 *   127.0.0.1:9222, so the Docker container can connect via
 *   host.docker.internal:29222.
 *
 * Usage:
 *   node scripts/cdp-proxy.mjs                    # default: 29222 → 9222
 *   node scripts/cdp-proxy.mjs --listen 29223      # custom listen port
 *   node scripts/cdp-proxy.mjs --target 9223       # custom target port
 *   node scripts/cdp-proxy.mjs --check             # check if TV is up, exit
 *   node scripts/cdp-proxy.mjs --ip                # print the LAN IP for
 *                                                  #   docker-compose extra_hosts
 *
 * Recommended: run via launch-tv.bat (Windows) which launches TV + proxy together.
 */

import net from "node:net";
import os from "node:os";

const LISTEN_PORT = parseInt(process.argv[2] ?? "29222", 10);
const TARGET_PORT = parseInt(process.argv[3] ?? "9222", 10);
const TARGET_HOST = "127.0.0.1";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the first non-internal IPv4 address suitable for extra_hosts. */
function getLanIp(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces).sort()) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

/** Check if the target CDP port is accepting connections. */
async function checkTarget(): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection(TARGET_PORT, TARGET_HOST, () => {
      sock.end();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
    sock.setTimeout(2000, () => { sock.destroy(); resolve(false); });
  });
}

// ─── Modes ────────────────────────────────────────────────────────────────────

const mode = process.argv.includes("--check") ? "check"
  : process.argv.includes("--ip") ? "ip"
  : "proxy";

if (mode === "check") {
  const ok = await checkTarget();
  process.stdout.write(ok ? "TV CDP port is reachable\n" : "TV CDP port is NOT reachable\n");
  process.exit(ok ? 0 : 1);
}

if (mode === "ip") {
  const ip = getLanIp();
  if (ip) {
    process.stdout.write(`${ip}\n`);
  } else {
    process.stderr.write("No LAN IP found — check your network connection\n");
    process.exit(1);
  }
  process.exit(0);
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

const ip = getLanIp();
process.stdout.write(`╔══════════════════════════════════════════════════════╗\n`);
process.stdout.write(`║     TradingView CDP Proxy                          ║\n`);
process.stdout.write(`╠══════════════════════════════════════════════════════╣\n`);
process.stdout.write(`║  Listening on  : 0.0.0.0:${String(LISTEN_PORT).padEnd(5)}                 ║\n`);
process.stdout.write(`║  Forwarding to : ${TARGET_HOST}:${String(TARGET_PORT).padEnd(5)}                  ║\n`);
if (ip) {
  process.stdout.write(`║  LAN IP        : ${(ip + ":" + LISTEN_PORT).padEnd(32)}║\n`);
  process.stdout.write(`║  extra_hosts   : host.docker.internal:${ip.padEnd(19)}║\n`);
}
process.stdout.write(`╚══════════════════════════════════════════════════════╝\n`);
process.stdout.write(`\n`);

const server = net.createServer((clientSocket) => {
  const clientAddr = `${clientSocket.remoteAddress}:${clientSocket.remotePort}`;
  process.stdout.write(`[connect] ${clientAddr}\n`);

  const targetSocket = net.createConnection(TARGET_PORT, TARGET_HOST, () => {
    // Bidirectional pipe
    clientSocket.pipe(targetSocket);
    targetSocket.pipe(clientSocket);
  });

  targetSocket.on("error", (err) => {
    process.stderr.write(`[error  ] target ${TARGET_HOST}:${TARGET_PORT} — ${err.message}\n`);
    clientSocket.destroy();
  });

  clientSocket.on("error", (err) => {
    process.stderr.write(`[error  ] client ${clientAddr} — ${err.message}\n`);
    targetSocket.destroy();
  });

  clientSocket.on("close", () => {
    process.stdout.write(`[disconn] ${clientAddr}\n`);
  });
});

server.on("error", (err) => {
  process.stderr.write(`[fatal  ] ${err.message}\n`);
  process.exit(1);
});

server.listen(LISTEN_PORT, "0.0.0.0", () => {
  process.stdout.write(`Proxy ready. Point Docker to host.docker.internal:${LISTEN_PORT}\n`);
  process.stdout.write(`\n`);
  process.stdout.write(`  In docker-compose.yml, use:\n`);
  process.stdout.write(`    DOCKER_HOST_INTERNAL=host.docker.internal\n`);
  process.stdout.write(`    TV_CDP_PORT=${LISTEN_PORT}\n`);
  process.stdout.write(`    TV_ENABLED=true\n`);
  process.stdout.write(`\n`);
  process.stdout.write(`Press Ctrl+C to stop.\n`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  process.stdout.write("\nShutting down CDP proxy...\n");
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  process.stdout.write("\nShutting down CDP proxy...\n");
  server.close(() => process.exit(0));
});
