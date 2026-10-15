// One URL-only resolver shared by Node CPU tools and the browser GPU page.
// Production: case siblings under /.../kaopu-geography-workbench/.
// Research: case under /research/, old frozen cases one level above research.
export function projectionSourceURLs(moduleURL=import.meta.url,{publishedLayout=false}={}){
 const caseRoot=new URL('../',moduleURL),caseParent=new URL('../../',moduleURL),researchLayout=/\/research\/$/.test(caseParent.pathname),sourceRoot=researchLayout?new URL('../../../',moduleURL):caseParent;
 const old=name=>new URL('hong-kong-main-city-r01/'+name,sourceRoot),local=name=>new URL(name,moduleURL);
 return {
  layout:researchLayout?'research':'published-sibling',sourceRoot,caseRoot,
  r03:new URL(researchLayout&&!publishedLayout?'hong-kong-map-sea-r03/publish-final/index.html':'hong-kong-map-sea-r03/index.html',sourceRoot),
  three:old('integration-aligned.js'),airport:old('airport.mjs'),city:old('city-buildings/runtime.mjs'),citySpatial:old('city-buildings/spatial.mjs'),
  outer:local('source-fixtures/outer-renderer.mjs'),outerSpatial:local('source-fixtures/outer-spatial.mjs'),
  hostPatches:old('base-host-patches.json'),outerManifest:new URL('outer-terrain/data/manifest.json',caseRoot)
 };
}
