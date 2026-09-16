# R041 runtime fix

The first public R041 commit displayed the HUD but left the WebGL canvas blank.

Root cause: `terrain.mjs` required `window.W.fineDetail`, but the original `core.js` API omitted that function from the exported object. The module rejected before terrain construction completed.

Fixes applied:
- add a defensive `fineDetail` field before loading `terrain.mjs`;
- expose the actual startup exception in the in-page failure panel instead of silently leaving a blank scene;
- retain the corrected field-surface world-axis orientation;
- rerun syntax, runtime-symbol, topology and irrigation checks in the full package.

Verified package checks:
- JavaScript syntax passed for `core.js`, `scene.mjs`, `terrain.mjs`, and `ecology.mjs`;
- the required numeric fields are available at runtime;
- topology and irrigation QA still pass: 137 fields, 285 irrigation relationships, no missing ports, no sampled plain-field overlaps, and no invalid terrain samples.

`visualAcceptance=false`

`productionReady=false`
