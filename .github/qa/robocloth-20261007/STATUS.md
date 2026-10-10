# RoboCloth reproduction checkpoint — 2026-10-07 06:48 UTC

## Status
Active implementation. This checkpoint is not a completed interactive workbench.

## Verified
- Official source frozen at `6d0d33c1687c9241deb92c19f1d39ea70849cb51`
- Official assets frozen at `438cdade7a02dd7e0085760279ec283139b39098`
- Only RoboCloth 145 / Ours_epoch112 downloaded, with the original cloth-on-bar meshes and 2048² / 512 spp reference PNG + linear EXR
- Full checkpoint SHA256 matches the official Hugging Face LFS SHA256
- Checkpoint ZIP metadata parsed with a restricted, non-executing pickle metadata reader; all storage entries use ZIP_STORED
- 20 inference tensors contain 772,696,192 bytes of float32 data; 771,751,936 bytes (736 MiB) are the full 46 × 2048 × 2048 latent texture
- 391,997,809 checkpoint bytes are excluded training/optimizer state and ZIP/metadata overhead
- Each retained tensor has an exact offset, size, dtype, shape and SHA256 manifest. No latent downsampling, quantization or precision conversion
- An actual HTTP byte-range read from the official Hugging Face file returned 206, exactly the requested 12 bytes, and matched the original factor tensor. Both resolver and CDN returned applicable CORS headers. Browser fetch remains a separate test, not yet passed
- CPU adapter preserves frozen upstream. Only mlp.py device placement changed from CUDA to CPU; safe mmap loading replaces executable checkpoint deserialization
- Official AnisotropicLatentTexturedModel evaluated 512 deterministic samples: 20 tensors loaded strictly, all outputs finite
- Original render.py + original MLPBRDF + original cloth-on-bar scene ran using Mitsuba 3.8.0 / DrJit 1.3.1 LLVM CPU. 64² / 4 spp diagnostic completed in 8.1 seconds. This is a smoke diagnostic, not a fidelity or final-quality claim
- Official reference pixels and diagnostic pixels inspected. Next run is 256² / 32 spp, then a meaningful higher-quality comparison

## Dependencies
Local virtualenv reuses read-only torch 2.4.0+cpu from the NeuralYarn environment; all RoboCloth-specific dependencies are isolated here. Upstream recommends torch 2.4.1, so this minor runtime difference remains documented. Mitsuba and DrJit versions match upstream. Set HOME to local-home and DRJIT_LIBLLVM_PATH to the verified system LLVM17 shared library. No GPU/backend/service was provisioned.

## Next
1. Finish meaningful offline reference comparison and preserve linear output evidence
2. Implement full float32 neural inference in the browser, including predicted frame, neural geometry, double bilinear query, degree-3 SH, skip MLP, factor and cosine conventions
3. Verify numerical parity using held-out deterministic fixtures before visual claims
4. Test real browser loading/CORS and WebGPU performance using the authorized GitHub Actions QA route
5. Integrate a separate cloth material bench beneath the existing tailor overview only after those gates

## Persistence
QA destination: `.github/qa/robocloth-20261007` on the existing `qa/tailor-garments-r03-20261006` branch. Product destination after coordination: `kaopu-tailor-workbench/robocloth/`. Other project paths stay unchanged. Large official weights stay at the official source; do not commit them to Pages.
