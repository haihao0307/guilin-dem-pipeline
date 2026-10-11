# ET14 Skin / Wrinkle Evolution

## Completed foundation

ET14 branch starts from ET13 identity system.

Added:
- layered wrinkle model instead of fixed carved grooves
- skin type profiles
- lesion category expansion framework
- automatic 36 character identity assignment framework

## Main changes

Wrinkles are separated into:

1. Structural wrinkles
- forehead
- glabella
- nasolabial
- marionette

2. Compression wrinkles
- eye area
- mouth area

3. Micro wrinkles
- whole face frequency layer

The response model follows the visual principle:

compression -> deeper and narrower
stretch -> wider and shallower

This is an approximation layer, not a complete biomechanical skin solver.

## Skin categories

Initial profiles:

- porcelain
- natural
- dry
- oily
- weathered
- youthful
- mature

Each profile controls:
- roughness
- pore tendency
- oil response
- color variation

## Identity generation

36 character assignment will no longer be random slider changes.

Each character receives:

- body-conditioned skin type
- facial bias
- wrinkle tendency
- lesion tendency

The original ET13 controls remain authoritative.

## Not yet claimed

Not complete until browser verification:

- wrinkle visual comparison
- 36 character rendering comparison
- archive restore
- no contamination of native face parameters
- desktop performance test

Mobile testing intentionally excluded for this stage.
