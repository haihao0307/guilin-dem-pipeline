import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const asDataURL = (bytes, type) => `data:${type};base64,${bytes.toString('base64')}`;

function replaceOnce(source, before, after, label) {
  if (source.split(before).length !== 2) throw Error(`Expected one locked URL at ${label}`);
  return source.replace(before, after);
}

/** Build-time URL adaptation only; files under src/cloth/upstream stay byte-identical. */
export async function buildClothBundles({esbuild, root, outDir = path.join(root, 'dist')}) {
  const clothRoot = path.join(root, 'src/cloth');
  const upstream = path.join(clothRoot, 'upstream');
  const lockBytes = await fs.readFile(path.join(clothRoot, 'sources.lock.json'));
  const lock = JSON.parse(lockBytes);
  const lockedBytes = new Map();
  for (const entry of lock.files) {
    const bytes = await fs.readFile(path.join(upstream, entry.path));
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) {
      throw Error(`Native cloth source lock mismatch: ${entry.path}`);
    }
    lockedBytes.set(entry.path, bytes);
  }
  const assetBase = `https://raw.githubusercontent.com/${lock.repository}/${lock.revision}/${lock.directory}/`;
  const wgslURL = asDataURL(lockedBytes.get('gpu-cloth.wgsl'), 'text/plain');
  const wasmURL = asDataURL(lockedBytes.get('cloth-kernel.wasm'), 'application/wasm');
  const workerPlugin = {
    name: 'locked-cloth-worker-assets',
    setup(build) {
      build.onResolve({filter: /^three$/}, () => ({path: path.join(upstream, 'vendor/three.module.js')}));
      build.onLoad({filter: /\/(assets|gpu-cloth|wasm-cloth)\.mjs$/}, async args => {
        if (!args.path.startsWith(clothRoot + path.sep)) return;
        let source = await fs.readFile(args.path, 'utf8');
        if (args.path === path.join(clothRoot, 'assets.mjs')) {
          source = replaceOnce(source, "new URL('./upstream/', import.meta.url)", `new URL(${JSON.stringify(assetBase)})`, args.path);
          source = replaceOnce(source,
            "fetch(new URL('./sources.lock.json', import.meta.url), {signal})\n    .then(response => {if (!response.ok) throw Error('Cloth source lock HTTP ' + response.status); return response.json();})",
            JSON.stringify(lock), args.path);
        } else if (args.path === path.join(upstream, 'gpu-cloth.mjs')) {
          source = replaceOnce(source, "new URL('./gpu-cloth.wgsl',import.meta.url)", JSON.stringify(wgslURL), args.path);
        } else if (args.path === path.join(upstream, 'wasm-cloth.mjs')) {
          source = replaceOnce(source, "new URL('./cloth-kernel.wasm',import.meta.url)", JSON.stringify(wasmURL), args.path);
        }
        return {contents: source, loader: 'js'};
      });
    },
  };
  const common = {bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true,
    write: false, metafile: true, sourcemap: false, plugins: [workerPlugin]};
  const clothBuild = await esbuild.build({...common, entryPoints: [path.join(clothRoot, 'worker.mjs')]});
  const geometryBuild = await esbuild.build({...common, entryPoints: [path.join(upstream, 'geometry-worker.mjs')]});
  const clothCode = Buffer.from(clothBuild.outputFiles[0].contents);
  const geometryCode = Buffer.from(geometryBuild.outputFiles[0].contents);
  for (const [label, result, code] of [['cloth', clothBuild, clothCode], ['geometry', geometryBuild, geometryCode]]) {
    if (/import\.meta/.test(code.toString())) throw Error(`Unresolved import.meta in ${label} Worker`);
    if (Object.values(result.metafile.outputs).some(output => output.imports.length)) throw Error(`Unbundled import in ${label} Worker`);
  }
  const manifest = {
    schema: 'crowd-cloth-browser-bundle@1',
    repository: lock.repository, revision: lock.revision, directory: lock.directory,
    sourceLockSHA256: digest(lockBytes), originalSourceModified: false,
    originalFilesVerified: lock.files.length, originalBytesVerified: lock.files.reduce((n, file) => n + file.bytes, 0),
    runtimeAssetBase: assetBase,
    sources: lock.files.map(entry => ({path: entry.path, bytes: entry.bytes, sha256: entry.sha256, url: entry.url})),
    workers: {
      cloth: {file: 'cloth-worker.js', bytes: clothCode.length, sha256: digest(clothCode)},
      geometry: {file: 'cloth-geometry-worker.js', bytes: geometryCode.length, sha256: digest(geometryCode)},
    },
    embeddedAssets: ['sources.lock.json', 'gpu-cloth.wgsl', 'cloth-kernel.wasm'],
    adaptations: [
      'Cloth and solid-geometry Worker entry points are IIFE bundles loaded from same-page Blob URLs.',
      'Binary/JSON asset paths use the immutable commit URL and existing byte-count/SHA256 verification.',
      'Original WGSL and fallback WASM bytes are data URLs, verified against the source lock at build time.',
      'Original fitting loads WASM through the existing verified byte loader before instantiation.',
      'Main renderer modules continue to use the existing F13 THREE namespace; Workers own no renderer.',
    ],
  };
  const summary = {revision: lock.revision, cloth: manifest.workers.cloth, geometry: manifest.workers.geometry,
    assetBase, sourceLockSHA256: manifest.sourceLockSHA256};
  const prelude = `(function(){\n` +
    `const makeURL=s=>URL.createObjectURL(new Blob([Uint8Array.from(atob(s),c=>c.charCodeAt(0))],{type:'text/javascript'}));\n` +
    `const workerURL=makeURL(${JSON.stringify(clothCode.toString('base64'))});\n` +
    `const geometryWorkerURL=makeURL(${JSON.stringify(geometryCode.toString('base64'))});\n` +
    `window.__CROWD_CLOTH_OPTIONS__=Object.assign({},window.__CROWD_CLOTH_OPTIONS__,{workerURL});\n` +
    `window.__CROWD_CLOTH_GEOMETRY_WORKER_URL__=geometryWorkerURL;\n` +
    `window.__CROWD_CLOTH_BUILD__=${JSON.stringify(summary)};\n` +
    `})();`;
  const mainPlugin = {
    name: 'blob-native-cloth-workers',
    setup(build) {
      build.onLoad({filter: /\/(index|solid-helpers|solid-textiles)\.mjs$/}, async args => {
        if (!args.path.startsWith(clothRoot + path.sep)) return;
        let source = await fs.readFile(args.path, 'utf8');
        if (args.path === path.join(clothRoot, 'index.mjs')) {
          source = replaceOnce(source, "new URL('./worker.mjs', import.meta.url)", 'window.__CROWD_CLOTH_OPTIONS__.workerURL', args.path);
        } else if (args.path === path.join(upstream, 'solid-helpers.mjs') || args.path === path.join(upstream, 'solid-textiles.mjs')) {
          source = replaceOnce(source, "new URL('./geometry-worker.mjs',import.meta.url)", 'window.__CROWD_CLOTH_GEOMETRY_WORKER_URL__', args.path);
        }
        return {contents: source, loader: 'js'};
      });
    },
  };
  await fs.mkdir(outDir, {recursive: true});
  await fs.writeFile(path.join(outDir, 'cloth-worker.js'), clothCode);
  await fs.writeFile(path.join(outDir, 'cloth-geometry-worker.js'), geometryCode);
  await fs.writeFile(path.join(outDir, 'cloth-assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(path.join(outDir, 'cloth-workers-metafile.json'), JSON.stringify({cloth: clothBuild.metafile, geometry: geometryBuild.metafile}, null, 2));
  return {mainPlugin, prelude, manifest};
}
