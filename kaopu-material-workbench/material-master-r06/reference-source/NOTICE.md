# Attribution and distribution notes

The self-authored C++ test harness, JSON packaging script and explanatory reports are provided under Apache-2.0. The reference numbers were computed by calling Adobe's original, unmodified implementation; they are not a browser implementation or an Adobe certification.

Adobe OpenPBR BSDF, Copyright 2026 Adobe, Apache License 2.0.
Pinned source: https://github.com/adobe/openpbr-bsdf/tree/c91aad1d1ce1693e803f039d7c92c2965c4eb013
License: licenses/Apache-2.0.txt. No Adobe header is copied into this contracts directory. The harness requires the separately pinned dependency to compile.

GLM by G-Truc Creation and contributors. The MIT option is selected from the repository's MIT/Happy Bunny dual licensing.
Pinned source: https://github.com/g-truc/glm/tree/6f14f4792a0cde5d0cf2c910506724d61cb95834
Full original copying notice: licenses/GLM-copying.txt. No GLM header is copied into this contracts directory.

The optional Three comparison in contract_tests.cpp is a CPU transcription of the direct-light equations in R05's actual vendored Three REVISION 170 shader strings. Copyright 2010-2024 Three.js Authors, MIT. License: licenses/Three-MIT.txt. This is not a GPU-render measurement. It excludes IBL and other parts of Three's renderer.

If publishing this harness or result tables, retain this notice, provenance and licenses. If distributing the upstream dependencies or a compiled binary, retain their required copyright/license notices as well. No SideFX Content Library file or adaptation is included or authorized for publication here.
