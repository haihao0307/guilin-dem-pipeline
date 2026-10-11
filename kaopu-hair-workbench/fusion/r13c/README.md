# R13C — continuous groom and depth coverage

User anchor: `a827dc71191a8394c3e98973cac5dde45fc1f716/kaopu-hair-workbench/fusion/r13/public-lite.html`. Source inherited from `78698827a763e706924da97d785f8f373ce055ce`. New isolated directory only. R12, R13 and other workbenches are read-only. Draft, no merge, force push or history rewriting.

## Diagnosis from the actual R13 source

R13 app explicitly selected `coverageResolve: blend`. FiberMaterial then used `transparent=true` and `depthWrite=false` for one unsorted dense mesh. This is order-dependent compositing, not evidence that every biological fibre is a translucent sheet. There was only one head mesh and one hairstyle mesh: the apparent two layers were not two independent visible hair objects.

The old root field blended opposed front/back vectors across a scalp-wide Z band, while guide interpolation applied a hard left/right restriction across the entire head. Neither described a finite frontal part or a localized crown whorl. Sideburns inherited a percentage of top length rather than a locally authored finishing length. These are separately testable causes; a single opacity slider cannot repair all of them.

## New implementation

`GroomTopology.js` defines soft anatomical masks, a posterior crown field and a finite frontal interpolation barrier. Labels do not delete strips of roots. The stored potential R12 roots remain fixed; explicitly recorded low-temple/nape trimming masks change visible density. Sideburn and nape lengths are independent controls. Long crown/fringe strands are not indiscriminately clipped at ear height.

Dense children reuse the same guide field, weighted root-relative bundle centers and coherent spatial phases. They no longer jump between arbitrary primary-guide phases and clump offsets at every nearest-guide boundary.

Visible fibre fragments use continuous per-strand coverage thresholds and native multisampling when available and nearest-depth writes. Physical tapered radii and analytic pixel coverage are retained. No dark solid helmet, opaque scalp cap or second hair layer is introduced. This removes order-dependent alpha blending, but thin isolated strands can still alias; it is not temporal reconstruction or film path tracing.

## Existing native head, not a new white mannequin

The head-only adapter uses the actual unified-human source at `99defb97123d8101fefddf5aa039991446f557a8`: CommonSkinLayer, native FaceSurface/FaceSkin, identity traits, ET15 natural MakeHuman eyes, ocular refinement and ET18-L2 lip surface/material. Both workbenches already share GNM lineage. The original head is replaced by one derived visible surface, not overlaid. The adapter preserves native Y-up units and documents the one LipMath display-axis conversion. No full body viewer, new scanned identity, screen-space diffusion or full expression system is claimed. Original atlas bytes, source hashes and licenses are recorded in NATIVE_HEAD_LOCK.json.

## Teachers and the actual transferred concepts

MakeHuman Eyebrows01 remains the licensed source of the existing 14 eyebrow styles. Perm and Digital Salon remain the previously recorded teachers; no neural model or CUDA engine is claimed to run here. Digital Salon's guide/follower and grouped interpolation principles inform the shared curve stream, not a copied retired female hairstyle.

SideFX Guide Groom: https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html — finite part barriers, local groups/masks, skin-relative interpolation and clearance. Workflow: https://www.sidefx.com/docs/houdini/fur/workflow.html — sparse guide authoring before dense generation.

Epic Groom Strands: https://dev.epicgames.com/documentation/en-us/unreal-engine/groom-strands-in-unreal-engine — group diagnostics, real strand widths and distinct visibility/lighting concerns. Performance reference: https://dev.epicgames.com/documentation/unreal-engine/groom-scalability-and-performance-with-unreal-engine — strand/point budgets and separate simulation, interpolation, visibility and lighting costs.

Pixar RenderMan visual targets: https://renderman.pixar.com/from-hick-to-hipster and https://renderman.pixar.com/hair-and-fur-material-presets — coherent large silhouette, local breakup, controlled pigment/highlights. These are offline production references, not proof of equal browser quality. No commercial renderer, project asset or proprietary shader was copied.

## Verification and limits

Node tests check finite part membership, ear-side field continuity, stable roots, independent trims, reproducibility, cancellation and sampled head-triangle guards. Browser tests inspect actual rendered pixels, loaded native head materials, real preset/trim controls, triangle-order invariance, multiple views and a 390×844 touch viewport. Screenshots must be visually reviewed independently; passing a nonblank-pixel check does not certify a hairstyle.

Static grooming only. No hair-hair dynamics, neck/body/clothing collision, measured fibre mechanics, multiple-scattering certification, mobile-device benchmark or cinematic acceptance. Dense generation and startup cost remain significant on ordinary machines; opening many simultaneous 3D workbenches can exhaust GPU/memory budgets. The user retains visual acceptance authority. Fixed public URLs and run reports are recorded only after actual tests.

## R13C.2 visual review

The first R13C.1 passed geometric and browser checks but was rejected on actual screenshots for visible pixel stippling and a radial exposed crown. Run 38129050237 compared two continuous per-strand alternatives with identical roots/geometry. The stratified native-MSAA option was selected, with the tested continuous depth-write fallback for no-MSAA contexts. No order-dependent translucent blend is used. This is not temporal antialiasing.

The crown now advects a localized tangent-dominant field along guide points, rather than projecting fixed straight radial spokes. Local crown root puff is reduced. The existing second directional light is repositioned to the rear quarter so the back of the hairstyle can be inspected, not hidden in black. Real guide colors show actual anatomical classifications. The native ET18 head remains one visible mesh. Desktop uses at least 1.5 display samples per CSS pixel; this improves thin-edge sampling but increases fill cost.

The nearest-guide early distance rejection now precedes expensive finite-part compatibility. A local 36k regression preserved identical root/curve hashes before and after that isolated optimization; this is not a device FPS claim. The full renderer and new crown geometry are separately retested. Prior cinematic and dynamic-physics limitations remain.
