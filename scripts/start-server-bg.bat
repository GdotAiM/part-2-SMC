@echo off
set PORT=3001
set MCP_PORT=3002
set LOG_LEVEL=info
set CORS_ORIGINS=*
set NODE_ENV=development
set TV_ENABLED=true
set TV_CDP_PORT=9222
set TV_CONNECTION_TYPE=desktop
set DATABASE_URL=postgresql://dummy:dummy@localhost:5432/nonexistent
cd /d C:\Users\cash\part-2-SMC\artifacts\api-server
start /B node --enable-source-maps ./dist/index.mjs > C:\Users\cash\part-2-SMC\api-server.log 2> C:\Users\cash\part-2-SMC\api-server.err.log
