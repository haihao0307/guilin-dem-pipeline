const REF=new URL('./',import.meta.url);
const refs={
  terrain:{role:'canonical-terrain-and-display-contract',url:'../r3-1/data/terrain.json',time:'source epoch unknown; see source lineage',truth:'measurement archive; display approximation separate'},
  hydro:{role:'coast-and-river-mapping',url:'../r3-1/data/rivers.json',time:'archived OSM observation',truth:'mapping evidence; not water level'},
  sea:{role:'demonstration-sea',url:'../r3-2/index.html',time:null,truth:'display demonstration; no tide or vertical datum claim'},
  landcover:{role:'land-cover-observation',url:'../r3-4/data/worldcover/worldcover-2021-context.json',time:'2021',truth:'class observation; not individual objects'},
  soil:{role:'SoilProfile',url:'./data/soil/soil-context.json',time:'locked SoilGrids model release',depths:['0-5cm','5-15cm','15-30cm','30-60cm','60-100cm','100-200cm'],resolutionM:250,truth:'model prediction; not field samples'},
  wrb:{role:'SoilProfile.classificationEvidence',url:'./data/wrb/wrb-context.json',time:'locked SoilGrids WRB release',resolutionM:250,truth:'official classification and post-alignment argmax retained separately'},
  water:{role:'HistoricalWaterObservation',url:'./data/water/water-context.json',time:'per-product periods; 1984-2024 or 2022-2024 component',truth:'historical evidence; no current level/topology claim'},
  osm:{role:'road-centrelines-and-building-footprints',url:'../r3-5/data/osm/osm-context.json',time:'archived OSM snapshot',truth:'mapped geometry; width and height unknown unless evidenced'}
};
export function queryLocation({easting,northing,crs='EPSG:32651'}){
  if(crs!=='EPSG:32651'||!Number.isFinite(easting)||!Number.isFinite(northing))throw Error('位置需要 EPSG:32651 的有限米制坐标');
  return {worldId:'wenzhou',location:{id:`EPSG:32651:${easting}:${northing}`,crs,units:'m',easting,northing,precisionClaim:'none beyond source evidence'},voiceRefs:Object.fromEntries(Object.entries(refs).map(([k,v])=>[k,{...v,url:new URL(v.url,REF).href,availability:'reference only; consult source mask and time before using'}]))};
}
export function installWorldScore(){
  window.wenzhouWorldScore=Object.freeze({queryLocation});
  const c=document.getElementById('terrain'),summary=document.getElementById('world-score-summary'),pre=document.getElementById('world-score-query');
  let last='';
  const terrain=fetch(new URL('../r3-1/data/terrain.json',REF)).then(r=>r.json());
  async function update(){const patch=c.dataset.patch;if(!patch||patch===last)return;last=patch;try{const t=await terrain;if(patch!==last)return;const q=t.queries?.find(x=>x.patch===patch);summary.textContent=q?`${q.name||patch} · 同一地点，8 个证据引用`:`${patch} · 区域视域；选择查询点可查看地点证据`;pre.textContent=q?JSON.stringify(queryLocation({easting:q.position.coordinates[0],northing:q.position.coordinates[1]}),null,2):'地形、海岸河流、演示海面、土地覆盖、土壤剖面、WRB、水体历史、OSM 共享同一参考架入口。';}catch(e){summary.textContent=`地点索引失败：${e.message}`;}}
  const observer=new MutationObserver(update);observer.observe(c,{attributes:true,attributeFilter:['data-patch']});void update();
}
