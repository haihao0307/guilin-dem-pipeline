# Current Best View — Gaussian ZSTD WASM memory R42 candidate

1. Three.js r186's bundled decoder initialized a 16 MiB WebAssembly memory in the executed Node environment.
2. A 24 MiB output from 787 compressed bytes retained 29.1875 MiB of WASM capacity; the same output from 25,166,410 compressed bytes retained 53.1875 MiB. Compressed input and output both affect growth.
3. Calling `free`, constructing another decoder object and then decoding a smaller stream did not shrink or reset 53.1875 MiB. Decoder objects share the fixed module instance.
4. `WebAssembly.Memory.byteLength` is retained capacity, not live allocator occupancy or total browser/process memory. R41 JavaScript arrays, fetch copies, later r186 constructor/GPU allocations and garbage-collection overlap remain separate.
5. A short-lived Worker/realm is only a candidate isolation strategy; it requires transfer/copy and lifecycle tests on macOS and 390×844 iPhone/Safari before adoption.
6. R33–R41 gates, Canonical Truth, Frozen R1 and production Mothers remain unchanged. No device limit or production implementation is authorized.
