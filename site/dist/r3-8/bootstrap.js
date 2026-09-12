import * as THREE from 'three';
import {installSoilContext} from './soil-context.js';
import {installEnvironmentContext} from './environment-context.js';
import {installWorldScore} from './world-score.js';
THREE.Object3D.prototype[Symbol.for('wenzhou.r3.3.surface-evidence-installed')]=true;
installSoilContext();installEnvironmentContext();installWorldScore();
await import('../r3-6/bootstrap.js');
document.documentElement.dataset.wenzhouR38Boot='true';
