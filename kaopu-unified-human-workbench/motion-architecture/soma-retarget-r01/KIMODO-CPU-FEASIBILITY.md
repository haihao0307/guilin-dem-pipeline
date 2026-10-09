# Kimodo CPU feasibility audit

Audit time: 2026-10-09 05:03 UTC. Source commit: `nv-tlabs/kimodo@58e781898b3d7e328a676a75d3e338c45dce3ad9`.

## Decision

**Kimodo has real official CPU code paths. Lack of a GPU is not by itself a hard blocker. However, the official default fully local text-to-motion pipeline is not memory-feasible on this particular 9.7 GiB, zero-swap machine without changing the loading/model strategy.**

The specific bottleneck is the LLM2Vec text encoder: its two small adapter repositories also require the gated Meta Llama 3 8B base weights. The complete download is roughly 17.5 GB including Kimodo, not 1.3 GB. Shortening the motion does not shrink these weights.

No Kimodo package was installed, no model/checkpoint was downloaded, and no Kimodo inference was run during this audit. This is source/metadata analysis plus read-only environment inspection, not a successful-generation claim.

## Verified current environment

Read at approximately 05:01–05:02 UTC:

- Python 3.12.14; PyTorch 2.14.1+cpu in the existing `soma-cpu/venv`.
- Total RAM `10,206,504 kB` (9.73 GiB), approximately 1.8 GiB available at inspection.
- Swap: 0. Workspace disk: approximately 22 GB available.
- Kimodo, hydra-core, omegaconf, transformers, peft, einops, gradio, gradio_client, safetensors, pydantic, and motion_correction were not installed in this venv.
- Existing successful SOMA work does not establish any Kimodo model/text-encoder compatibility or inference result. Keep the SOMA environment unchanged.

## Official CPU support and CUDA audit

1. [generate.py lines 276–289](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/scripts/generate.py#L276-L289) selects `cuda:0` only when `torch.cuda.is_available()`; otherwise it passes `cpu` to `load_model`. There is no CLI `--device` option; CPU selection is automatic without a GPU.
2. [load_model.py](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/model/load_model.py) explicitly accepts `device="cpu"`. Its local text-encoder preset is only `llm2vec`, default `bfloat16`, with a supported `text_encoder_fp32=True` option.
3. [LLM2Vec wrapper lines 40–47](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/model/llm2vec/llm2vec_wrapper.py#L40-L47) honors `TEXT_ENCODER_DEVICE` and also falls back from `auto` to CPU without CUDA.
4. [Official quick start](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/docs/source/getting_started/quick_start.md) documents `TEXT_ENCODER_DEVICE=cpu`. Its “<3 GB VRAM” claim describes CPU text encoding plus GPU denoising; it is not a claim about total system RAM.
5. Audited model, motion representation, skeleton, constraints, and postprocess sources contain no unconditional `.cuda()` or CUDA-only denoiser extension requirement. The denoiser uses ordinary PyTorch TransformerEncoder layers with nested tensors disabled. Text-encoder CUDA attention/multiprocessing branches are conditional.
6. `tools.seed_everything` calls `torch.cuda.manual_seed_all`. This is not an allocation of CUDA tensors; no inference incompatibility has been established from that call.
7. [loading.py](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/model/loading.py) reads checkpoint tensors on CPU. Full end-to-end compatibility with this particular PyTorch 2.14.1 CPU build remains **untested**.
8. No packaged smaller text-encoder preset, quantization flag, or disk-offload configuration was found in the inspected loading path. A quantized replacement would be an engineering experiment rather than the verified official recipe.

## Smallest relevant official model package

All seven registered generation variants are displayed as approximately 1.13 GB on their official HF file pages; none is a materially smaller “CPU lite” model. For this SOMA workflow use the current explicit identifier `Kimodo-SOMA-RP-v1.1`; the versionless default currently resolves to it. Switching from RP to SEED does not meaningfully reduce download size.

Required SOMA model files:

| File | Size / role |
|---|---|
| `model.safetensors` | **1,133,185,036 bytes**, approximately 1.133 GB |
| `config.yaml` | 675 bytes; 30 fps, SOMASkeleton30 internal, 4096-dimensional text condition |
| `stats/motion/body/{mean,std}.npy` | Approximately 3.04 kB each |
| `stats/motion/global_root/{mean,std}.npy` | 168 bytes each |
| `stats/motion/local_root/{mean,std}.npy` | 160 bytes each |
| Repository skeleton assets | Supplied by the Kimodo source/package; required for skeleton operations |

The six stats files total approximately 6.74 kB. Retain LICENSE/README provenance alongside a local model copy. Native SOMA mesh assets are optional for a skeleton-NPZ generation test; model skeleton assets are not optional.

Model weight SHA-256 from the official pointer: `ef0a0ca45a6089ab4532dde609785771ae3f38755b4ae6cf314b0213e07cd4a3`.

Sources: [weight pointer](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1/raw/main/model.safetensors), [model files](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1/tree/main), [config](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1/blob/main/config.yaml), [stats](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1/tree/main/stats/motion). HF metadata was read live; these HF revisions are not fixed by the GitHub code commit, so pin their revisions separately before a reproducible run.

## Text encoder download and license chain

The apparent “177 MB text model” is only an adapter/tokenizer repository:

| Source | Required data | Reported size | License / access |
|---|---|---|---|
| `meta-llama/Meta-Llama-3-8B-Instruct` | Four safetensors shards, index/config | About 4.98 + 5.00 + 4.92 + 1.17 = **16.07 GB** using rounded HF sizes | **Llama 3 Community License**, gated; contact-sharing/terms acceptance and authorized account access required |
| `McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp` | Adapter, adapter config, model config, tokenizer files | Adapter about **168 MB**; repo about **177 MB** including ~9.09 MB tokenizer | HF card declares **MIT** for this adapter repo; underlying Llama license still relevant |
| `McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised` | Second adapter and adapter config | About **168 MB** | HF card declares **MIT**; underlying Llama license still relevant |

The [MNTP adapter config](https://huggingface.co/McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp/blob/main/adapter_config.json) explicitly names `meta-llama/Meta-Llama-3-8B-Instruct` as its base. The Kimodo loader merges the MNTP adapter and loads the supervised adapter on top. Metadata does not imply the user already has access to the gated base model.

Official sources: [Meta base model files and gate](https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct/tree/main), [MNTP files](https://huggingface.co/McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp/tree/main), [supervised files](https://huggingface.co/McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised/tree/main).

Kimodo source is Apache-2.0. SOMA/G1 Kimodo checkpoint cards use [NVIDIA Open Model License](https://huggingface.co/nvidia/Kimodo-SOMA-RP-v1.1/blob/main/LICENSE). SMPLX-RP uses NVIDIA’s separate internal scientific R&D model license and is gated, so it is not the appropriate shortcut for this publishing workflow. Do not treat any checkpoint license as permission to republish unrelated motion-capture source data.

## Exact blockers

- **Confirmed RAM mismatch:** unquantized BF16 Llama encoder parameters alone are well above the machine's total RAM, even allowing for an unused language-model head. Official loading moves the model as a whole to its device; the current path does not configure disk offload. FP32 approximately doubles parameter memory and is not a remedy. A 1-second clip only reduces motion-sequence activations.
- **Missing runtime:** Kimodo and key dependencies are absent. Official requirements include `transformers==5.1.0`, `peft>=0.18`, `hydra-core>=1.3`, and `omegaconf>=2.3`. Do not silently alter the proven SOMA venv.
- **Gated base access unresolved:** no authenticated weight-access check, sign-in, contact transmission, license acceptance, or download was performed.
- **No remote text service established:** the default is local `http://127.0.0.1:9550/`; it is not a free public NVIDIA service. No reachable authorized service was supplied or verified.
- **CPU inference and timing unmeasured:** no claimed latency, quality, peak RSS, operator failure, or generated clip. Static device support is evidence to attempt a run, not evidence it succeeded.

## Executable next path

### Preferred on this machine: CPU denoiser plus official encoder elsewhere

1. Obtain an explicitly authorized and reachable instance running Kimodo's official `kimodo_textencoder` with the exact prescribed Llama/MNTP/supervised models. Verify the service and permissions before sending a prompt. The service may run on a sufficiently large CPU machine or GPU; it need not run on this memory-limited host.
2. In a separate Kimodo environment, install the pinned source plus official dependencies; avoid the interactive demo extras for an NPZ smoke test. `SKIP_MOTION_CORRECTION_IN_SETUP=1` is an official setup switch if initially omitting the native postprocess extension; pair it with `--no-postprocess`.
3. Download/pin only the selected ~1.13 GB Kimodo model plus config/stats to this host. Recheck available RAM before loading; the current ~1.8 GiB available does not establish enough headroom for model construction, checkpoint tensors, activations, and imports.
4. Force `TEXT_ENCODER_MODE=api` and set `TEXT_ENCODER_URL` to the verified service. Do not use `auto`, whose failure path will try to download/load the oversized local encoder.
5. After those prerequisites, run the official CLI with a small diagnostic case, e.g. one sample, 1.0 second, 10 diffusion steps, seed 42, `--no-postprocess`. This is a smoke test, not an official quality benchmark. It should write a real NPZ through the official save path.
6. Check all numeric arrays are finite; check frame count and 30 fps; confirm the exported SOMA joint layout and rotations; record code/model revisions, prompt, seed, steps, wall time, and peak RSS. Only then label it “official Kimodo CPU denoiser inference”; distinguish the remote text-encoding stage.
7. Run the final requested duration/100-step clip and any postprocessing separately after the smoke test. Never present a low-step diagnostic as the quality result.

Command shape, **not run**:

```bash
TEXT_ENCODER_MODE=api TEXT_ENCODER_URL="$VERIFIED_KIMODO_TEXT_ENCODER_URL" \
  kimodo_gen "A person walks forward." \
  --model Kimodo-SOMA-RP-v1.1 --duration 1.0 --num_samples 1 \
  --diffusion_steps 10 --seed 42 --no-postprocess \
  --output kimodo_cpu_smoke
```

[Official API client](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/model/text_encoder_api.py) calls the Gradio `/DemoWrapper` endpoint. A generic embedding API or arbitrary 4096-dimensional vector is not an equivalent substitute.

### Fully local alternative

Move the experiment to an authorized CPU environment with enough real RAM and disk for the unquantized encoder, model loading peaks, and activations; 32 GiB RAM is a sensible starting planning budget, **not an official certified minimum or a measured peak**. Preserve BF16 as the official starting path and verify operator compatibility; FP32 may require materially more RAM. Lack of a GPU alone still does not block this route.

### If the immediate need is an official example rather than new inference

The pinned repository includes small pre-generated motion examples:
- `01_single_text_prompt/motion.npz`: 217,398 bytes, metadata says 5 seconds, seed 42, 100 steps.
- `08_stylized_text/motion.npz`: 175,522 bytes, metadata says about 4.033 seconds, seed 42, 100 steps.

These could support an explicitly labeled “official precomputed example” import after asset/provenance review. They must never be counted as a clip generated locally or evidence of CPU model inference. This audit did not download or republish them.

## Audit evidence

Read-only source evidence (43 text files, about 330 kB) was saved in `evidence/kimodo-cpu-audit/`, from the pinned GitHub commit. No production file, model weight, repository publication, environment package, or existing SOMA artifact was changed.

### Later read-only addendum, 05:08 UTC

At the parent's subsequent request, the 217,398-byte official example was retrieved and inspected (not a weight download or inference run). It is a legacy **150-frame, somaskel30, three-array** NPZ, not a current complete somaskel77 export. Full fixed-blob provenance, schema, joint hierarchy, validation, and the example-specific license-coverage caveat are in `KIMODO-OFFICIAL-SAMPLE-AUDIT.md` and [KIMODO-SAMPLE-PROVENANCE-QA.json](KIMODO-SAMPLE-PROVENANCE-QA.json). The original example NPZ was not republished; only this research report and its schema/hash evidence are included here.

