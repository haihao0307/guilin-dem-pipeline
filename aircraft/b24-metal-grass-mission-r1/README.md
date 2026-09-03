# B24 metal and grass mission R1

This is a new visual and mission enhancement candidate built from the actual currently published review aircraft. It does not claim to recover the missing exact V016 HTML.

## Inherited aircraft

- Review file: B24_V012_PROPELLER_INTERFACE_REVIEW.html
- Review HTML bytes: 12,557,938
- Review HTML SHA-256: 7cf4c78cea99f9bf3aed5507cbcb2bdb49a71465b3c4aabc29563214f3da2fde
- Native payload bytes: 16,647,376
- Native payload SHA-256: 7ba1b923844f5161911e9aa63b18191e0d08ff8de4b3750204aa544320bd34c2
- Source hierarchy: 1784 components, 348 source meshes, 325358 triangles.
- Original geometry buffers, node hierarchy, and animation arrays are retained without rewriting.
- Four rotating spindles use source nodes 1454, 1385, 1431, 1408. Their axes and direction come from their source quaternion tracks.
- Gear and bomb-bay movements sample inherited source tracks separately.

## This change

A reversible PBR metal appearance, clear-sky reflection environment, shared-coordinate grass airstrip, 330-second complete visual mission, synthesized sound, camera modes, pause/reset/scrub controls, and ground-triggered explosion effects.

The airstrip and aircraft share one Three.js scene and one camera. Aircraft forward is +Z and world up is +Y. No mountains, separate weather frame, substitute aircraft mesh, or historical livery approval is added. Weather remains out of scope for this review.

The mission is a deterministic visual demonstration, not an engineering flight dynamics or weapons model. The sound is synthesized, not a historical B24 recording.

## Stable components and approvals

The readable modules are the source of truth. BUILD_MANIFEST.json records the exact deployed file hashes. Never substitute a file because it has a similar version number. Do not remake the whole workbench for an unrelated visual change.

After the user accepts a component, preserve its actual files, parameters, and accepted visual evidence together. The existing accepted artifact remains usable during development. Modify only the requested component and inspect its genuine dependencies. Technical test success does not set user visual acceptance.

Current user visual acceptance: pending. Current productionReady: false.

## Browser evidence

The QA workflow runs the actual WebGL page with the real inherited payload. It captures parked, takeoff, cruise, bay-open, explosion, approach, landing, shutdown and mobile views; checks audio output; and plays a whole mission without injected impacts. Browser evidence, code identity, and user visual acceptance are separate states.

## Online delivery

The validated candidate is published to a separate review directory. Existing production/recovery entry points must remain untouched. All application modules and renderer dependencies are same-origin, pinned and locally served after publication.
