import manifest from './StreamingManifest.json';
const source=location.hostname==='htmlpreview.github.io'?decodeURIComponent(location.search.slice(1)):location.href;
export const transportConfig={manifest,assetBase:new URL('.',source).href};
