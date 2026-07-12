# Start API server with TradingView integration
$env:PORT="3001"
$env:MCP_PORT="3002"
$env:LOG_LEVEL="info"
$env:CORS_ORIGINS="*"
$env:TV_ENABLED="true"
$env:TV_CDP_PORT="9222"
$env:TV_CONNECTION_TYPE="desktop"
$env:TV_DATA_SOURCE="app"
$env:TV_INTERACTION="readwrite"
$env:TV_SYNC_LEVELS="true"
$env:NODE_ENV="development"

Write-Host "Starting API server on port 3001..."
node --enable-source-maps dist/index.mjs
