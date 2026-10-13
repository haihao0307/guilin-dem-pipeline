import streaming from './StreamingManifest.json';
// P3 expects chunk.file and file.label; the native pack uses url and id.
// Keep its byte verification, retry and cache algorithm unchanged.
const manifest={...streaming,files:streaming.files.map(f=>({...f,label:f.id==='hot'?'首屏原生数据':f.id,chunks:f.chunks.map(c=>({...c,file:c.url}))}))};
const source=location.hostname==='htmlpreview.github.io'?decodeURIComponent(location.search.slice(1)):location.href;
export const transportConfig={manifest,assetBase:new URL('.',source).href};
