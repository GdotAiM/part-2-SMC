#!/usr/bin/env bash
cd /c/Users/cash/part-2-SMC/artifacts/api-server
export PORT=3001
export MCP_PORT=3002
export LOG_LEVEL=info
export TV_ENABLED=true
export TV_CDP_PORT=9222
export TV_CONNECTION_TYPE=desktop
export TV_DATA_SOURCE=app
export TV_INTERACTION=readwrite
export NODE_ENV=development
node --enable-source-maps ./dist/index.mjs >> /c/Users/cash/part-2-SMC/api-server.log 2>&1
