import streaming from './StreamingManifest.json';
// P3 expects chunk.file and file.label; the native pack uses url and id.
// Keep its byte verification, retry and cache algorithm unchanged.
const manifest={...streaming,files:streaming.files.map(f=>({...f,label:f.id==='hot'?'首屏原生数据':f.id,chunks:f.chunks.map(c=>({...c,file:c.url}))}))};
const source=location.hostname==='htmlpreview.github.io'?decodeURIComponent(location.search.slice(1)):location.href;
export const transportConfig={manifest,assetBase:'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/'};
