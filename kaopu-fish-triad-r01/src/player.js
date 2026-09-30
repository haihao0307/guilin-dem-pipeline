import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import resolvedScore from '../scores/resolved/MUSKELLUNGE_RESOLVED_SCORE_R01.json';
import { build, update, measure, snapshot, dispose, VERSION } from './instrument.js';

const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.setClearColor(0x071317);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);
camera.position.set(1.18, 0.62, 1.32);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.135, 0);
controls.enableDamping = true;
controls.update();
scene.add(new THREE.HemisphereLight(0xb9d6db, 0x142229, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(-1.1, 1.8, 1.9); key.castShadow = true; scene.add(key);
const rim = new THREE.DirectionalLight(0x75bfd0, 1.6); rim.position.set(0.8, 0.4, -1.8); scene.add(rim);
const handle = build(resolvedScore);
scene.add(handle.root);
const stats = measure(handle);
let mode = 'CRUISE_DIAGNOSTIC';
let t = 0;
document.querySelector('#meta').textContent = `${VERSION} · ${stats.bones} bones · ${stats.vertices.toLocaleString()} vertices · external assets 0`;
document.querySelectorAll('button[data-mode]').forEach((button) => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  document.querySelectorAll('button[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
}));
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(Math.max(1,r.width|0),Math.max(1,r.height|0),false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(canvas); resize();
const clock = new THREE.Clock();
function frame(){t += Math.min(clock.getDelta(),0.05);update(handle,t,{}, {mode});controls.update();renderer.render(scene,camera);requestAnimationFrame(frame)}
window.__KAOPU_PLAYER_READY__=true;
window.__KAOPU_PLAYER_MEASURE__=stats;
window.__KAOPU_PLAYER_SNAPSHOT__=snapshot(handle);
window.addEventListener('beforeunload',()=>{dispose(handle);renderer.dispose()});
frame();
