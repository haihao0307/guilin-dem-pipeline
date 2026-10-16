$taskRoot=Split-Path $PSScriptRoot -Parent
$taskZig=Join-Path $PSScriptRoot 'toolchain/zig-windows-x86_64-0.13.0/zig.exe'
if(!(Test-Path -LiteralPath $taskZig)){throw 'Install pinned Zig 0.13.0 into tools/toolchain first'}
& $taskZig build-exe -target wasm32-freestanding -O ReleaseFast -fno-entry -rdynamic --export-memory --import-symbols '--initial-memory=134217728' '--max-memory=268435456' -cflags -O3 -fno-fast-math -- (Join-Path $taskRoot 'candidate/cloth-kernel.c') ('-femit-bin='+(Join-Path $taskRoot 'candidate/cloth-kernel.wasm'))
if($LASTEXITCODE -ne 0){throw 'WASM kernel build failed'}
