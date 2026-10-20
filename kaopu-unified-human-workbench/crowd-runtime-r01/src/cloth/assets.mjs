import {sha} from './upstream/source-contract.mjs';

export const CLOTH_REVISION = 'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49';
const baseURL = new URL('./upstream/', import.meta.url);

/** Immutable source bytes only. No fitted state or action results are cached. */
export function createAssetLoader({readBytes, manifest, signal} = {}) {
  const pending = new Map();
  const getManifest = Promise.resolve(manifest || fetch(new URL('./sources.lock.json', import.meta.url), {signal})
    .then(response => {if (!response.ok) throw Error('Cloth source lock HTTP ' + response.status); return response.json();}));
  async function bytes(path) {
    if (pending.has(path)) return pending.get(path);
    const promise = (async () => {
      const lock = await getManifest;
      if (lock.revision !== CLOTH_REVISION) throw Error('Unexpected native cloth source revision');
      const entry = lock.files.find(row => row.path === path);
      if (!entry) throw Error('Unregistered cloth source asset: ' + path);
      let raw;
      if (readBytes) raw = await readBytes(path);
      else {
        const response = await fetch(new URL(path, baseURL), {signal});
        if (!response.ok) throw Error('Cloth asset HTTP ' + response.status + ': ' + path);
        raw = await response.arrayBuffer();
      }
      const data = raw instanceof ArrayBuffer ? raw : raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
      if (data.byteLength !== entry.bytes || await sha(data) !== entry.sha256) throw Error('Cloth source digest mismatch: ' + path);
      return data;
    })();
    pending.set(path, promise);
    try {return await promise;} catch (error) {pending.delete(path); throw error;}
  }
  const json = async path => JSON.parse(new TextDecoder().decode(await bytes(path)));
  const unzip = async path => new Response(new Blob([await bytes(path)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const gzipJSON = async path => JSON.parse(new TextDecoder().decode(await unzip(path)));
  return {bytes, json, unzip, gzipJSON, manifest: getManifest};
}
