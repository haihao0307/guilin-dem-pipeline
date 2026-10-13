# Timber emitter equivalence, staged exact reference

The first monolithic comparison compiled/linked at the frontend but crashed SwiftShader on first draw with SPIR-V ID overflow. Its all-zero outputs were rejected; it established no equality.

This revision splits only the original expanded 144-statement reference into 16 consecutive nine-member GPU programs. Their original statements are concatenated and asserted byte-identical to the original body; the reconstructed full function SHA must equal the reference function SHA. Every original child, order, strict tie comparison, 30.01 mm prune, physical mother call and float field remains present. Four RGBA32F attachments carry the complete physical winner between stages. Only the final reference stage resets d to baseD, as the original did. No sampled material/world approximation or CPU material evaluation is used. The complete loop candidate runs separately in one shader.

The 12,864 unchanged points cover all 144 members' faces, edges and corners with +/-0.2 mm perturbations, the pruning/near-field boundaries, stone adjacency and window-aperture points. Ages 0, 0.5 and 1 give 38,592 finite-domain comparisons. This is not an all-domain proof or architectural image acceptance.

Readback compares d/id/seed/baseD, q/sourceSeed, extents and the re-evaluated physical distance, plus point identity. A context loss, nonfinite result, all-zero output, invalid winner or feedback attachment is an immediate failure. Frontend compilation has a 240-second limit; all actual GPU draws and readbacks have a separate 240-second limit. Completed draw timings include first-use backend work and are not realtime claims.

From the candidate directory:

```sh
node qa/heritage-timber-emit.mjs
C=../kowloon-train88-r01/compiler/target/release/kaopu-station-shader-bridge
for n in $(seq 0 15); do
 timeout 240s $C qa/heritage-timber-generated/reference-$n.wgsl qa/heritage-timber-generated/reference-$n.frag heritageTimberProbe
done
timeout 240s $C qa/heritage-timber-generated/candidate.wgsl qa/heritage-timber-generated/candidate.frag heritageTimberProbe
node qa/heritage-timber-run.cjs
```

The manifest records all 16 slice hashes, the reconstructed reference hash, loop function hash, unchanged member descriptors and all sample coordinates. The test closure excludes evaluateStationMatter, so the independently tested once-only shading-state fix cannot change either timber side.
