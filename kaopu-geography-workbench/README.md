<p align="center">
  <img src="brand/kaopu-terrain-production-logo.png" width="96" alt="KAOPU 地形构建生产线标志">
</p>

# KAOPU Geography R17

This publication adds only an isolated geography-workbench directory and its scoped QA workflow. Other hosted projects are untouched.

RME4 Crater remains a separate original entry. Underwater Crater uses the inherited implicit field with inverse-coordinate scaling: X/Z = 2/3, vertical distances = 2, pivot y = 2.1 in the source coordinate system. It is not a replacement blue-hole mesh. Sea height is 3.1 in source units. The shader uses the same original noise and scene() equations, with separate clear-water display and inspection cameras. No unit conversion to surveyed meters is claimed.

Seven entries: Endless Cave, Layered Relief, Cave Passage II, Desert Canyon 2017, RME4 Crater, Underwater Crater, Snow Fractal Ridge. Persistent DOM navigation; only one active render. Drag/zoom and view/ratio controls apply to the new underwater entry. Teacher video does not drive the simulation clock.

The web edition is a lightweight deployment. Reference recordings and experimental replacement textures remain in the conversation's complete companion package. Local video can be opened in the optional reference panel. The canyon loads the original public channel images rather than substitutes.

## Brand mark

The selected terrain-production icon is stored in `brand/` and appears at the front of the overview workbench and as the browser icon. This branding layer does not modify any scene shader, geometry, material, grain, camera path, or interaction logic.

## Sources and rights
- Moon Surface II, Nikos Papadopoulos / 4rknova, 2015, Creative Commons Attribution-NonCommercial-ShareAlike 3.0. https://www.shadertoy.com/view/4tlXzr
- Desert Canyon, Shane. Log-Bisection Tracing by nimitz / stormoid, Creative Commons Attribution-NonCommercial-ShareAlike 3.0. https://www.shadertoy.com/view/Xs33Df and https://www.shadertoy.com/view/4sSXzD
- Desert Passage II: user-provided Image/Common/Cube A source. Includes David Hoskins Hash without Sine, Creative Commons Attribution-ShareAlike 4.0, and attributed IQ, Fabrice, Tomkh, Alex Evans / Dave Smith / Media Molecule techniques retained in the complete source archive.
- RME4 Crater: user-provided source and recording. Original authorship is not transferred to KAOPU by this port.
- Snow Fractal Ridge: David Lovera / Unix, 2015, based on Kali, Creative Commons Attribution-NonCommercial-ShareAlike 3.0.

This is a shader-learning and derived-study workbench; renaming or changing the environment does not remove original license restrictions. Original commented sources are retained in the accompanying package. No commercial authorization is asserted.

## Verification
`qa_public.py` targets the deployed HTTPS page using a real Chromium WebGL2 implementation and records actual render/interaction outcomes. Mobile coverage is an emulated viewport, not physical-phone testing. Results must be read from the workflow artifact, not assumed from the presence of this script.

## Seventh terrain: Endless Cave

BoyC, The Cave (https://www.shadertoy.com/view/MsX3RH), CC BY-NC-SA 3.0 (https://creativecommons.org/licenses/by-nc-sa/3.0/). User-provided shader preserved byte-for-byte at `sources/endless/original.frag`; provenance and exact channel hashes at `sources/endless/provenance.json`. This is an inverse-square potential field traced at fixed steps, not a true SDF or Perlin-noise reconstruction. Camera, light path, field constants, grain, mirrored triplanar samples and original step counts are unchanged. No commercial license is asserted. The private user reference video is not hosted.

## Independent runnable studies I3

The original seven R17 scenes and runtime remain unchanged. Completed independent cases use newly authored shape, movement, camera and procedural-material functions with no teacher source or image textures. Small card images are actual rendered frames. Unfinished cases are omitted from the visible catalog until accepted, with their numbers reserved.

- Study 08: Open Canyon / 开阔峡谷. Self-authored source SHA-256: `261db7db873d4680d1deb48e238aa8b76eaf7a5cf261ce35a5db8e31bcd6d4e5`. Visual learning reference: https://www.shadertoy.com/view/MdBGzG. This is an independent visual study, not an exact port or physical simulation.
- Study 09: Pelagic Manta / 海中蝠鲼. Self-authored source SHA-256: `a4c15f35658855f0ba8d52831525c69fd824845c8f5f2ab3d15273838f89a14e`. Visual learning reference: https://www.shadertoy.com/view/4ls3zM. This is an independent visual study, not an exact port or physical simulation.
- Study 10: Undersea Explorer / 海底探险船. Self-authored source SHA-256: `e9bfe8f503c878f039dee49673a02fcb97a78f117f8af91f359aa2103d17a1f9`. Visual learning reference: https://www.shadertoy.com/view/ldBBDm. This is an independent visual study, not an exact port or physical simulation.
