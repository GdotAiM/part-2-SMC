---
tags: [tradingview, cdp, mcp, integration]
aliases: [TV Desktop, TV Integration]
---

# TradingView Desktop Integration

**Location:** `src/lib/integrations/tradingview-desktop/`  
**Connection:** `chrome-remote-interface` (CDP) on port 9222  
**Internal API:** `window.TradingViewApi._activeChartWidgetWV.value()`

## Architecture

```
TV Desktop (Electron)
  └── --remote-debugging-port=9222
        ↓
chrome-remote-interface (CDP)
  ├── evaluate() / evaluateAsync()
  ├── screenshot()
  └── reconnectTo()  (tab switching)
        ↓
tradingview-desktop/ (86 MCP tools)
  ├── core/connection.ts
  ├── chart.ts (8 tools)
  ├── drawing.ts (5 tools)
  ├── data.ts (10 tools)
  ├── alerts.ts (3 tools)
  ├── indicators.ts (3 tools)
  ├── pane.ts (4 tools)
  ├── replay.ts (6 tools)
  ├── tab.ts (3 tools)
  ├── ui.ts (12 tools)
  ├── pine.ts (12 tools)
  ├── capture.ts (1 tool)
  ├── watchlist.ts (3 tools)
  └── health.ts (2 tools)
        ↓
FastMCP Server (port 3002)
```

## Key Internal API Methods

| Method | Purpose |
|---|---|
| `.symbol()` / `.resolution()` | Read chart state |
| `.setSymbol(sym)` / `.setResolution(tf)` | Change chart |
| `.createShape({time,price}, {shape,overrides,text})` | **Reliable drawing** |
| `.createMultipointShape([...], options)` | Multi-point shapes |
| `.getAllShapes()` / `.getShapeById()` | Read drawings |
| `.getAllStudies()` / `.getStudyById()` | Read indicators |
| `.createStudy(name, ...)` | Add indicator |
| `.removeAllShapes()` / `.removeEntity()` | Delete drawings |
| `.symbolExt()` | Symbol info + exchange |
| `._chartWidget.model().mainSeries().bars()` | Read OHLCV data |

## Drawing API (Reliable)
```javascript
// Single-point shape (horizontal line, text)
chart.createShape(
  { time: 1700000000, price: 64300 },
  { shape: 'horizontal_line', overrides: { color: '#22c55e' }, text: 'BSL @ 64,300' }
);

// Two-point shape (trend line, fib, rectangle)
chart.createMultipointShape(
  [{ time: 1690000000, price: 62000 }, { time: 1700000000, price: 65300 }],
  { shape: 'fib_retracement', overrides: { color: '#a855f7' }, text: '' }
);
```

## Supported Shapes
`horizontal_line`, `trend_line`, `fib_retracement`, `rectangle`, `ray`, `vert_line`, `text`, `polyline`, `arrow`, `circle`, `ellipse`, `pitchfork`, `gann_fan`, `signal`, `risk_reward`, `prediction`, `date_range`, and more.

## Session Management
MCP uses HTTP Stream transport. Initialize:
```bash
curl -s -X POST http://localhost:3002/mcp \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"client","version":"1.0"}},"id":"1"}'
```

## CDP Proxy (Windows)
When Docker needs to reach TV Desktop on Windows:
```
scripts/cdp-proxy.mjs  →  0.0.0.0:29222 → 127.0.0.1:9222
```
