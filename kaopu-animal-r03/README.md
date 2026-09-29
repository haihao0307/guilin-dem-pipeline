# KAOPU Animal Instrument R03 / K3.0.0

Three short independent animal scores share one procedural instrument. R03 is isolated from older Fish/Bird/Coral production lines; K1/K2 remain unchanged.

This is a reference-guided approximate 3D reconstruction, NOT a scan, exact anatomy, or a proof of arbitrary-animal compression. The user's three single-view low-resolution photographs do not determine hidden surfaces, size, feather counts, scute boundaries, skeletons or movement. Those portions are modeling assumptions. The tortoise species remains unresolved. No reference photograph is embedded in the instrument or scores.

## Use

Open KAOPU_ANIMAL_PLAYER.html in a WebGL2 browser and paste/import one .score file. The player contains NO animal scene, examples or stored animal mesh. An initially blank world is intentional until a score arrives. It runs offline without a server/CDN. The online workbench separately supplies three example scores.

KAOPU_ANIMAL_K3.js is the pure generation library. It exposes KAOPUAnimal.THREE, VERSION, SCHEMA, parseScore, buildScore, measure, fingerprint, snapshot, verifyReplay and dispose. It has no UI or instantiated camera and no reference images or example scores.

```js
const result = KAOPUAnimal.buildScore(scoreText);
scene.add(result.root);
console.log(KAOPUAnimal.measure(result.root, result.score));
// When replacing:
KAOPUAnimal.dispose(result.root);
```

A consuming world provides camera/lights/renderer. Use the bundled THREE to avoid duplicate engine versions, or use the ready-to-open standalone player.

## Grammar

K3|B,length,bulk,stance,fur,seed#coat
K3|E,span,leftWingAngle,rightWingAngle,tailSpread,seed#brown,white,yellow
K3|T,shellLength,dome,neck,stance,seed#shell,skin

All numbers are positional; trailing defaults may be omitted. Colors are 3/6 hex digits. Units: meters; Y up; +Z front. Bear length and eagle horizontal span normalize the generated envelope. Tortoise size refers to nominal carapace length, not full head/feet span. Example dimensions are assumptions, not measurements of the supplied photos. Defaults live in SCHEMA.

The B/E/T labels select versioned parametric archetypes, NOT a hidden table of final meshes. Rules generate continuous surfaces, appendages and detail distributions. This version handles ONLY these three archetypes, not arbitrary species.

## Generation and limitations

Bear: smooth-union implicit quadruped skin; shoulder/neck/muzzle transitions; paws, ears, eyes, nose and claws; seeded tapered fur ribbons.
Eagle: continuous trunk/head skin; curved asymmetric feather vanes; layered wings, splayed primaries and tail; hooked beak, eyes and talons. Feather layouts are modeling approximations.
Tortoise: domed carapace with geometrically indented seams and growth ridges; approximate structured scutes; continuous limbs/neck/head; irregular keratin scales, folds and nails. No species-level claim.

Static reference-inspired poses only. Camera rotation is not locomotion. No validated gait, flight physics or growth model.

Short scores move shared knowledge into the instrument; information does not disappear. Generated geometry memory and raster cost can greatly exceed file size. No universal mobile FPS claim. Actual output arrays, transforms, instance data and material parameters are compared for replay; pixel identity across GPUs is not promised.

## Sources

Primary visual references: the user's three images in this conversation, supplied 2026-09-29 (image(20260929-063841).png, image(20260929-063853).png, image(20260929-063914).png).
Supplementary morphology references checked 2026-09-29:
- https://animals.sandiegozoo.org/animals/polar-bear
- https://www.allaboutbirds.org/guide/Bald_Eagle/id
- https://animals.sandiegozoo.org/animals/galapagos-giant-tortoise (comparison only; does not identify the photographed tortoise)
Three.js 0.180.0 is pinned; MIT license retained in the instrument and LICENSE_THREE.txt.

## Gates

- [x] No generated image substitutes for real interactive 3D.
- [x] Actual production source changed, isolated from other projects.
- [x] Real Three.js generated meshes, camera controls and score editing.
- [ ] Public fixed HTTPS, exact byte checks and real-browser verification completed only when PUBLICATION_PROOF.json reports shareAllowed=true.
- [ ] Standalone empty player tested with all three independent scores; consult proof.
- [x] Screenshots alone do not count as delivery.

Machine checks do not imply visual approval: visualAcceptance=PENDING_USER; productionReady=false.
