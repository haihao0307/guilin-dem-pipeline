import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import proj4 from 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/+esm';

const partUrls = [1,2,3,4,5,6].map(index => `./app.part${index}.js?v=3203`);
const sources = await Promise.all(partUrls.map(async url => {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`地貌运行时分片 ${url} HTTP ${response.status}`);
  return response.text();
}));
const runtimeSource = sources.join('\n')
  .replace("const DATA_ROOT = '/guilin-dem-pipeline/yangshuo-lijiang-2048-v300/data';", "const DATA_ROOT = './data';")
  .replace("const RIVER_URL = '/guilin-dem-pipeline/yangshuo-noise-terrain-v310/data/lijiang_osm.geojson';", "const RIVER_URL = './data/lijiang_osm.geojson';");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('THREE', 'OrbitControls', 'proj4', runtimeSource);
await run(THREE, OrbitControls, proj4);
