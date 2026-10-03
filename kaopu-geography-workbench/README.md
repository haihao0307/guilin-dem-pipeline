# KAOPU Geography R16

This publication adds only an isolated geography-workbench directory and its scoped QA workflow. Other hosted projects are untouched.

RME4 Crater remains a separate original entry. Underwater Crater uses the inherited implicit field with inverse-coordinate scaling: X/Z = 2/3, vertical distances = 2, pivot y = 2.1 in the source coordinate system. It is not a replacement blue-hole mesh. Sea height is 3.1 in source units. The shader uses the same original noise and scene() equations, with separate clear-water display and inspection cameras. No unit conversion to surveyed meters is claimed.

Six entries: Layered Relief, Cave Passage II, Desert Canyon 2017, RME4 Crater, Underwater Crater, Snow Fractal Ridge. Persistent DOM navigation; only one active render. Drag/zoom and view/ratio controls apply to the new underwater entry. Teacher video does not drive the simulation clock.

The web edition is a lightweight deployment. Reference recordings and experimental replacement textures remain in the conversation's complete companion package. Local video can be opened in the optional reference panel. The canyon loads the original public channel images rather than substitutes.

## Sources and rights
- Moon Surface II, Nikos Papadopoulos / 4rknova, 2015, Creative Commons Attribution-NonCommercial-ShareAlike 3.0. https://www.shadertoy.com/view/4tlXzr
- Desert Canyon, Shane. Log-Bisection Tracing by nimitz / stormoid, Creative Commons Attribution-NonCommercial-ShareAlike 3.0. https://www.shadertoy.com/view/Xs33Df and https://www.shadertoy.com/view/4sSXzD
- Desert Passage II: user-provided Image/Common/Cube A source. Includes David Hoskins Hash without Sine, Creative Commons Attribution-ShareAlike 4.0, and attributed IQ, Fabrice, Tomkh, Alex Evans / Dave Smith / Media Molecule techniques retained in the complete source archive.
- RME4 Crater: user-provided source and recording. Original authorship is not transferred to KAOPU by this port.
- Snow Fractal Ridge: David Lovera / Unix, 2015, based on Kali, Creative Commons Attribution-NonCommercial-ShareAlike 3.0.

This is a shader-learning and derived-study workbench; renaming or changing the environment does not remove original license restrictions. Original commented sources are retained in the accompanying package. No commercial authorization is asserted.

## Verification
`qa_public.py` targets the deployed HTTPS page using a real Chromium WebGL2 implementation and records actual render/interaction outcomes. Mobile coverage is an emulated viewport, not physical-phone testing. Results must be read from the workflow artifact, not assumed from the presence of this script.
