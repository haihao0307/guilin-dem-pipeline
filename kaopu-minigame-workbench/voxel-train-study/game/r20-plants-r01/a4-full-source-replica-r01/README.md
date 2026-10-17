# Complete original A4 source-scene replica candidate

Open index.html via HTTP(S). It loads the full A4 source scene by default: 331 nodes, 200 meshes, 22 original materials, 2 original images / 3 texture objects, and all 71 original animation channels. No model rescaling, simplified geometry, replacement material system, A6 exterior, or default part isolation. Controls fit only the camera, play/pause the original animation, and restore the original bind pose.

CPU tests verify every original primitive attribute/index byte, node/world transforms, material values and bindings, image decoding and texture sampler/UV/color-space settings, and all original animation time/value fields and target bindings. Tests do not by themselves establish visual or mechanical acceptance. The workflow runs actual Chromium/WebGL tests and saves viewport evidence. Before that run passes, browser verification remains pending.

The public object.json is a provenance-minimized copy, not byte-identical to the local archive. Only non-runtime local provenance is omitted; its entire runtime content is unchanged. fields.bin.gz is the existing lossless transport envelope: decompression restores all original 47,362,176 field bytes, verified against the original payload and per-field SHA256 hashes. No geometry decimation or image loss is introduced. Full local source archives and detailed internal working reports remain local.

Run npm test for CPU/integrity tests and npm run test:browser for the browser test. Dependencies are pinned to established official packages. The browser viewer uses the included local Three.js vendor files, without a CDN.

Source: “Train Class A4 Union of South Africa” by timblewee, CC BY 4.0. See ATTRIBUTION.txt for the original source, author, license links and change notice. Public distribution includes only the licensed visible glTF scene and its original image payloads. This is a source-scene replica, not an independently authored replacement model.
