@echo off
set PORT=3001
set MCP_PORT=3002
set LOG_LEVEL=info
set CORS_ORIGINS=*
set NODE_ENV=development
set TV_ENABLED=true
set TV_CDP_PORT=9222
set TV_CONNECTION_TYPE=desktop
set FIREWORKS_API_KEY=fw_999FR8g7mGZA5WCX5SBzyH
set LLM_PROVIDER=fireworks
set LLM_MODEL=accounts/fireworks/models/deepseek-v4-pro
cd /d C:\Users\cash\part-2-SMC\artifacts\api-server
node --enable-source-maps ./dist/index.mjs
