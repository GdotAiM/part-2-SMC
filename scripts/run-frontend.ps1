$env:PORT = "3000"
$env:BASE_PATH = "/"
$env:NODE_ENV = "development"
Set-Location "C:\Users\cash\part-2-SMC\artifacts\liquidity-hunter"
npx vite --config vite.config.ts --host 0.0.0.0
