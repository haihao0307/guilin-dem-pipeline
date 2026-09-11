import * as THREE from 'three';
import {installSoilContext} from './soil-context.js';

// R3.7 replaces the old query-only R3.3 soil appearance demo in the current
// workbench with the full-domain SoilGrids context. The historical R3.3 files
// remain untouched and recoverable; this flag only prevents the redundant
// display hook from being installed in the R3.7 page.
THREE.Object3D.prototype[Symbol.for('wenzhou.r3.3.surface-evidence-installed')]=true;

installSoilContext();
await import('../r3-6/bootstrap.js');
document.documentElement.dataset.wenzhouR37Boot='true';
