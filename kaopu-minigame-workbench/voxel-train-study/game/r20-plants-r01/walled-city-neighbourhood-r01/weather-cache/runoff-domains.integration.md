# Source-bounded V26 runoff candidate: host integration

This is a candidate adapter, not a replacement material or fluid solver. Production files have not been edited by this worker. The legacy path should remain selectable for same-camera comparison.

## Verified diagnosis

Real GPU run 38135442707, commit cacd775c: the actual wet/dry, component, normal and primitive images were inspected. Hard vertical lines coincide with the red V26 streak contribution, not the dense triangle boundary pattern. API dry versus shader hard bypass has 0 changed pixels; restored wet versus original has 0. Removing micro perturbation changes at most 1 RGB byte. The metric plaster bridge was not a cure for this water-source artifact.

## Surface-plan option

The smallest integration does not require editing surface-plan.mjs: adapt its returned plan inside buildNeighbourhood. Add an optional runoff=false argument to that factory, preserving the legacy default until visual acceptance.

Imports in neighbourhood.mjs:

import {adaptSurfacePlanRunoff,createRunoffWeatherCacheSet,bindRunoffReceiver} from './weather-cache/runoff-domains.mjs';

Replace only the surface-plan creation expression:

const baseSurfacePlan=makeSurfacePlan(recipe);
const surfacePlan=runoff?adaptSurfacePlanRunoff(recipe,baseSurfacePlan):baseSurfacePlan;

Keep the existing weatherCaches, waterBindings, plasters and resource arrays. Alternatively, the owner may expose the same option in makeSurfacePlan; apply the adapter once, not twice.

## Shared cache construction

Inside the existing createWeatherNumericSampler try/finally:

if(runoff){
  const shared=createRunoffWeatherCacheSet({sampler,surfacePlan});
  for(const [id,cache] of shared.caches){
    weatherCaches.set(id,cache);
    proof.weatherDomains.push({domain:cache.domain,metrics:cache.metrics});
  }
  proof.runoffCaches=shared.metrics;
}else{
  // Keep the original per-domain createWeatherStateCache loop unchanged.
}

Retain the original sampler.dispose() finally. Do not loop through all 120 candidate domains calling createWeatherStateCache independently: that discards the exact template sharing.

## Three receiver binding sites

Immediately AFTER the existing original bindBrickWater, bindMortarWater and bindPlasterWater calls, add respectively:

if(spec.runoff)resources.push(bindRunoffReceiver({THREE,material:batch.material,plan:spec.runoff}));
if(spec.runoff)resources.push(bindRunoffReceiver({THREE,material:mesh.material,plan:spec.runoff}));
if(spec.runoff)resources.push(bindRunoffReceiver({THREE,material:made.material,plan:spec.runoff}));

The existing water binding must happen first. Repeated calls for the same wall-shared mortar material return the same idempotent handle. Different domains on a shared material are rejected. Brick instance patches retain the original nine attributes and are not rebuilt or duplicated by this adapter. Plaster interiors are recognized from their existing proof.faces, then explicitly receive sourceCount=0 and groundDamp=0. Shared brick/mortar surfaces additionally use an exterior-depth gate.

Keep setWaterEnabled as it is. Its uniform still switches all water off, including the new adapter. bindRunoffReceiver.setEnabled(false) is only a diagnostic bypass of the envelope within the NEW local domain; it is not the original 27 m baseline. For the true old-versus-new comparison, build the two runoff=false/true variants.

## Bounded GPU A/B

weather-cache/runoff-domains.qa.mjs exports runRunoffDomainComparison({THREE,renderer,report}). The default build function is buildNeighbourhood; a host can supply an equivalent build callback that accepts runoff.

The entry creates no renderer, browser or RAF. It runs the same R02 recipe with runoff=false and runoff=true, at identical borrowed-door and street-eye cameras plus one actual W1 sill close-up. Six PNGs, two completed readbacks each. It throws if the host ignored runoff=true or any water-bound candidate material missed the runoff binding. Strip shot.png before putting returned shots in the receipt. It returns build times, original metrics, cache accounting and actual source coordinates.

The legacy water-numerical QA selector that checks exact IDs W-front/E-right will match no candidate domains. Select actual candidate IDs from surfacePlan.domains (for example the first W-front/... and E-right/...), rather than treating an empty numerical test list as a pass. Existing raw V26 cache QA still applies: the original source field is retained within each real wall domain. The finite envelope and ground-only composition are additional explicitly adapted stages.

## Fixed measurable boundaries

- 49 actual sill undersides and 16 exposed actual slab/roof edges in the current recipe; no imaginary roof line on each wall and no inferred pipe leaks
- Slab intervals covered by an actual upper wall are excluded; a detached service pipe endpoint is not automatically a rain source
- Optional declared outlets must name a real pipe object and coincide with an actual adjacent exterior endpoint
- True source position and its wall projection are both recorded; projection/envelope are declared adaptations, not solved fluid trajectories
- Rain has no effect above its source, beyond a 0.9 m sill or 1.35 m eave fall, outside its bounded horizontal support, or on the interior side
- Original p input retains the same 1.25 m/unit scale on all three axes; original source formulas remain byte-for-byte. Internal yNorm now uses a real 2.6 m wall, never the 27 m tower
- Upper walls feed zero lowerDamp into the source rain call. The original .06–.34 height gate and .58 weight are separately allowed only for a wall touching actual ground (bottom -0.02..0.10 m) and only on its exterior
- No new stochastic kernel, image/visible texture, tessellation, vertex attribute, or material palette change
- Global water strength, wet colour, wetBlend and roughness driver remain unchanged

## Resource bounds and tests

Current candidate: 120 logical wall domains, 33 shared numerical templates, only 18 original V26 GPU bakes / 21,280 sampled nodes. Fifteen inactive, non-ground templates require no GPU field sampling. Shared retained low-state arrays total 155,648 bytes, versus 515,840 bytes without sharing. At most two physical sources are active per wall in this recipe; a hard maximum of eight is enforced. Per-fragment original cheap-field cost remains at most the original five hashes plus deterministic smoothstep/exp source gates. No full noise evaluation is added to the frame shader.

39/39 CPU tests passed, including nine new runoff tests and original source/cache/plaster contracts. GPU A/B is not run yet; visual and interactive acceptance remain false. Root rendering, exact brightness, drip appearance and start-up timing must be judged from the host's real readbacks.

New implementation/test/QA/report files are confined to weather-cache/runoff-domains*. No scene, material mother, building recipe or host entry was edited by this worker.
