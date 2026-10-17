#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p reports assets runs site local-home
curl -L --fail 'https://codeload.github.com/theialab/robocloth/tar.gz/6d0d33c1687c9241deb92c19f1d39ea70849cb51' -o upstream.tar.gz
mkdir -p upstream
tar xzf upstream.tar.gz -C upstream --strip-components=1
python3 scripts/download_assets.py
python3 scripts/inspect_checkpoint.py
python3 scripts/prepare_cpu.py
python3 -m venv .venv
.venv/bin/pip install 'torch==2.4.1' --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install 'numpy==1.26.4' 'mitsuba==3.8.0' 'drjit==1.3.1' 'pytorch-lightning==2.6.1' 'hydra-core==1.3.2' 'omegaconf==2.3.0' 'opencv-python-headless==4.10.0.84' 'pandas<3' pyyaml imageio pillow openexr pyexr trimesh simplejpeg
# Use a compatible, installed LLVM shared library path on the destination.
export HOME="$PWD/local-home"
export DRJIT_LIBLLVM_PATH="${DRJIT_LIBLLVM_PATH:-/usr/lib/x86_64-linux-gnu/libLLVM-17.so}"
.venv/bin/python scripts/model_cpu.py
.venv/bin/python scripts/run_original_cpu.py
