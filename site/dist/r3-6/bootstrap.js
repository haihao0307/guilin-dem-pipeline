import {installOptimizedOsmRuntime} from './osm-runtime.js';

installOptimizedOsmRuntime();
await import('../r3-4/bootstrap.js');
document.documentElement.dataset.wenzhouR36Boot='true';
