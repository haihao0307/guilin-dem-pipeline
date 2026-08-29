import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import proj4 from 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/+esm';

// Publisher compatibility marker retained until the workflow contract advances: v=3450.
const partUrls = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36].map(index => `./app.part${index}.js?v=3640`);
if (!partUrls.includes('./app.part24.js?v=3640') || !partUrls.at(-1)?.endsWith('app.part36.js?v=3640')) throw new Error('地貌运行时尾分片合同缺失');
const sources = await Promise.all(partUrls.map(async url => {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`地貌运行时分片 ${url} HTTP ${response.status}`);
  return response.text();
}));
const boot = "proj4.defs('EPSG:32649','+proj=utm +zone=49 +datum=WGS84 +units=m +no_defs +type=crs');\nawait initRenderer();bindUI();const requested=params.get('preset');await buildPreset(PRESETS[requested]?requested:'atlas');";
let runtimeSource = sources.join('\n');
if (!runtimeSource.includes(boot)) throw new Error('地貌运行时启动合同缺失');
runtimeSource = runtimeSource
  .replace(boot, '')
  .replace("const DATA_ROOT = '/guilin-dem-pipeline/yangshuo-lijiang-2048-v300/data';", "const DATA_ROOT = './data';")
  .replace("const RIVER_URL = '/guilin-dem-pipeline/yangshuo-noise-terrain-v310/data/lijiang_osm.geojson';", "const RIVER_URL = './data/lijiang_osm.geojson';")
  + `\n${boot}`;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('THREE', 'OrbitControls', 'proj4', runtimeSource);
await run(THREE, OrbitControls, proj4);
