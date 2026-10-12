# R54 removable eye surface candidate

Runtime files: `EyeSurfaceMath.mjs`, `NativeEyeSurfaceR54.mjs`. Install immediately after the unchanged `attachAppearanceR52` returns:

```js
const {attachNativeEyeSurfaceR54} = await import('./eye-candidate/NativeEyeSurfaceR54.mjs');
const eyeSurface = attachNativeEyeSurfaceR54(fullCommonWorkbench.motion().viewer.skin);
```

The harness's viewer already exposes `.skin`; use that same skin passed to R05EyeBridge. No Three import, asset path, texture initialization or teacher viewer is required. Keep all six R52 face controls, cameras, expression settings and reference lighting frozen. Retain the existing programmatic iris pigment scale.

```js
eyeSurface.enabled(false); // Existing E1 surface and edge formulas
eyeSurface.enabled(true);  // Candidate
eyeSurface.set({reflectionStrength: 1.2, pupilFeather: .008});
eyeSurface.report();
eyeSurface.dispose();      // Restore previous exact compile and cache-key hooks
```

When the owning `attachAppearanceR52` is disposed, its existing E1 disposal automatically removes this surface layer first. Dispose any later material extension before this layer. Do not attach teacher FullFaceViewer, NaturalEyeState, NaturalEyeShader or OcularRefinement.

Run `node --test EyeSurface.test.mjs` from this directory for the pure-function and real-source hook tests. `fixtures/` holds exact audited project blobs used only by those tests. Deploying the runtime needs only the two runtime modules. Source and license findings, defaults, dependency gaps and limitations are in SOURCE-AUDIT.md.

## Required isolated Actions checks

1. Freeze archive, positions, faces, eye chart and original E1 atlas before install. Assert exact equality after install, parameter changes, off/on, restore and disposal. Do not change the R52 identity to improve the eye result.
2. Record page/shader errors and the compiled report. Require `compiles > 0`, finite pixels and zero new failed requests. Confirm zero new image/texture requests.
3. Render the same close front, three-quarter and profile eyes in neutral and the frozen smile. Include a bare-eye crop with hair hidden for inspecting the native lid/opaque-cover relationship. Contact-shadow report must remain false.
4. With the same scene/camera, compare E1, candidate, candidate off, and disposed. Off and disposed must restore baseline pixels; if exact off pixels differ, report the measured difference and inspect before accepting. Restore uniforms and lighting after every probe.
5. Compare the candidate with a moved directional light; then independently tint that light red/green and set its intensity to zero. Check that added finite-source radiance responds to each actual scene light, rather than following a camera-fixed painted patch. Disable other directional sources for the single-source probe, then restore them.
6. Existing geometry contact diagnostics remain authoritative. R54 neither fixes nor conceals original penetrations. Do not mark contact or likeness accepted solely because the appearance shader compiles.

No repository commit, external message, production update or browser execution was performed by the adapter worker.
