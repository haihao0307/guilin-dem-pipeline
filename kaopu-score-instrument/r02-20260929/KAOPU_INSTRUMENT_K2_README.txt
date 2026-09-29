KAOPU INSTRUMENT K2.0.0

File: KAOPU_INSTRUMENT_K2.js
Global API: globalThis.KAOPUInstrument

The file contains the K2 parser, procedural geometry generator and its Three.js runtime.
It contains no page UI, camera, controls, example score or the R02 spatial composition.

Browser use:
<script src="KAOPU_INSTRUMENT_K2.js"></script>
<script>
  const { THREE, buildScore, measure, dispose } = KAOPUInstrument;
  const scene = new THREE.Scene();
  const result = buildScore('K2|A12,2{s.1}');
  scene.add(result.root);
  console.log(measure(result.root, result.score));
  // dispose(result.root) when finished.
</script>

Version contract: a score beginning with K2| must be replayed by a compatible K2 instrument.
Units: metre. Axis: Y up.
