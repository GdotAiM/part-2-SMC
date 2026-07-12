# ──────────────────────────────────────────────────────────────────────────────
# Docker Build — SMC Pulse Predict
# ──────────────────────────────────────────────────────────────────────────────
# Builds all Docker images and optionally pushes to GitHub Container Registry.
#
# Usage:
#   .\scripts\docker-build.ps1                    # Build all images
#   .\scripts\docker-build.ps1 -Push              # Build + push to GHCR
#   .\scripts\docker-build.ps1 -Tag v1.0.0        # Tag + push
# ──────────────────────────────────────────────────────────────────────────────

param(
  [switch]$Push,
  [string]$Tag = "latest"
)

$REPO = "ghcr.io/gdotaim/part-2-smc"
$COMPOSE = "deploy/local/docker-compose.yml"

Write-Host "╔═══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SMC Pulse Predict — Docker Build            ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build the API runner image
Write-Host "[1/3] Building API server image..." -ForegroundColor Yellow
docker build -f Dockerfile --target runner -t "$REPO/api-server:$Tag" .
if ($LASTEXITCODE -ne 0) { Write-Host "API build failed!" -ForegroundColor Red; exit 1 }
Write-Host "  ✅ api-server:$Tag" -ForegroundColor Green

# Step 2: Build the frontend nginx image
Write-Host "[2/3] Building frontend image..." -ForegroundColor Yellow
docker build -f Dockerfile --target frontend -t "$REPO/frontend:$Tag" .
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build failed!" -ForegroundColor Red; exit 1 }
Write-Host "  ✅ frontend:$Tag" -ForegroundColor Green

# Step 3: Tag as latest if not already
if ($Tag -ne "latest") {
  docker tag "$REPO/api-server:$Tag" "$REPO/api-server:latest"
  docker tag "$REPO/frontend:$Tag" "$REPO/frontend:latest"
  Write-Host "  ✅ Tagged as latest" -ForegroundColor Green
}

Write-Host ""
Write-Host "Images built successfully!" -ForegroundColor Green

# Step 4: Push to registry (optional)
if ($Push) {
  Write-Host "[4/4] Pushing to $REPO ..." -ForegroundColor Yellow
  docker push "$REPO/api-server:$Tag"
  docker push "$REPO/frontend:$Tag"
  if ($Tag -ne "latest") {
    docker push "$REPO/api-server:latest"
    docker push "$REPO/frontend:latest"
  }
  Write-Host "  ✅ Pushed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run locally:" -ForegroundColor White
Write-Host "  docker compose -f $COMPOSE up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "or using your own images:"
Write-Host "  docker compose -f $COMPOSE pull" -ForegroundColor Gray
