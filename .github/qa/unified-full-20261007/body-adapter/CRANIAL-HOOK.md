# Joint-conditioned rest packet and caller-owned final matrices

A single pose-independent rest vertex per canonical vertex cannot preserve the existing influence-coupled native identity/expression/MLP transfer. The correct factorization has one rest point per **nonzero CSR influence slot**. It uses the existing complete CSR weights and is skinned once.

The ordinary `evaluate()` implementation is unchanged. The separate hook is:

```js
const evaluated = adapter.evaluate(nativeState, targetOptions);
const packet = adapter.influenceRestPacket(evaluated);
const body = adapter.skinInfluenceRestPacket(packet, {
  skinMatrices: finalSkinMatrices,
});
// Equivalent input, when the caller already owns the final posed skeleton:
const sameBody = adapter.skinInfluenceRestPacket(packet, {
  posedMatrices: finalPosedMatrices,
});
```

Both inputs require all 127 final matrices, in row-major form acting on column vectors. The hook does not compose, insert, suppress or reorder a GNM root transform. Given posed matrices, it computes finalSkin[j] = finalPosed[j] × inverse(targetRestBind[j]).

## Coordinates and data

`packet.restPositionsPerInfluence` is a Float64 array with `3 * weights.values.length` entries. Slot k belongs to joint `weights.joints[k]`, and vertex i owns slots `weights.ptr[i] ... weights.ptr[i+1]-1`. Each slot already includes that vertex's base target-rest position plus its correctly conditioned native identity/expression/MLP rest delta.

Coordinates are **common unposed target-rest metres, Z-up**, with the target Anny root placement used by the fixed canonical body. Native source deltas first convert from MHR centimetres/Y-up to (δx, -δz, δy)/100. Do not transform them into posed/world space again before the supplied final skin matrix.

The packet carries the unchanged CSR weights, 127 target rest/posed/skin matrices, names/parents, source state, target shape and topology ID. It is specific to the evaluated native state and configured Anny target rest. Rebuild it when native identity/expression/pose-dependent correctives or target rest changes. Changing only the additional GNM root transform can reuse a packet with new final matrices.

## Exact factorization

For canonical vertex i and native source sample s, let b_is be its normalized barycentric coefficient, w_sj the complete native skin influence, and W_ij = Σ_s b_is w_sj the stored CSR weight. Let x_i be the canonical target rest vertex, T_j its target bind, S_j the converted source bind, l_j the existing displacement scale and δ_s the observed native rest change.

The CSR slot rest point is:

p_ij = x_i + [Σ_s b_is w_sj l_j linear(T_j S_j⁻¹) δ_s] / W_ij

The final body is Σ_j W_ij F_j p_ij, where **F_j is the final skin matrix supplied by the caller**. This equals the original per-source/per-influence formula. Averaging p_ij over j before applying F_j would introduce the prohibited cross terms.

## GNM composition in the existing parent model

The parent has specified that GNM's root G is in common **rest** coordinates, followed by the outer body skin. For that convention the caller supplies:

- finalSkin_j = originalSkin_j × G_rest for selected cranial influences
- finalPosed_j = originalPosed_j × inverse(bind_j) × G_rest × bind_j

Unselected influences retain their matrices. The parent controls cranial membership, source ownership and the GNM transformation. A transform defined instead in already-posed world coordinates would have another multiplication order; the adapter imposes neither.

`test-hook-arbitrary-matrices.mjs` uses a nonzero body root rotation plus native shoulder/elbow/twist, identity and expression. It compares both multiplication orders and arbitrary per-joint rotation/scale/translation against an independent direct per-source sum. All three comparisons and final-posed versus final-skin entry points are byte-identical at Float32 output. The two G orders differ by 75.906 mm, so the fixture catches wrong-order composition.

`test-cranial-hook.mjs` also compares the packet against the unchanged default evaluator across nine cases. Maximum component discrepancy is 0.000059605 mm from accumulation rounding. Its 288 mixed-weight neck vertices pass an analytic partial-weight translation test; incorrectly multiplying the cranial weight a second time would cause a 5 mm error in that fixture.

## Shared MHR identity under Anny rig ownership

The parent owns this policy: all 45 MHR identities are shared shape state. When Anny owns articulation, saved MHR 204-channel rig values and MLP effects are inactive; the parent may obtain the MHR identity rest displacement by evaluating zero pose, zero expression and correctives=false, and apply that combined rest shape through the Anny rig once. This does not require changing the adapter's default MHR evaluation or ownership guard. Head identity transfer remains a separate parent-owned mapping.
