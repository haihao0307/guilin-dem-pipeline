import {ROUTE_TENANTS} from './street-identities.mjs';
export const ROUTE_SCHEMA='kaopu.street.route/1';
const random=seed=>{let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
export function validateRoute(s){
 const inspect=(o,depth=0)=>{if(depth>16)throw new Error('Excessive route nesting');if(typeof o==='string'&&/^(https?:|data:|blob:|file:)/i.test(o))throw new Error('External route asset');if(o&&typeof o==='object')for(const[k,v]of Object.entries(o)){if(/^(mesh|meshes|vertices|indices|buffer|bufferView|runtimeMesh|runtimeModel|binary|binaryUrl|geometry|texture|textures|textureUrl|modelUrl|meshUrl|glbUrl|fbxUrl|normalMap|roughnessMap|__proto__|prototype|constructor)$/.test(k))throw new Error('Forbidden route field '+k);inspect(v,depth+1);}};inspect(s);
 if(s?.schema!==ROUTE_SCHEMA||s.instrument?.id!=='kaopu.street.architecture'||s.instrument?.version!=='1.2.0'||s.instrument?.abi!=='KST1'||s.units!=='metre'||s.axis!=='Y_UP'||s.timeSource!=='host.elapsed')throw new Error('Route score contract mismatch');
 if(s.span?.fromStation!==0||s.span?.toStation!==1||s.span?.sceneMetres!==700||s.span?.anchorOffset!==27||s.span?.historicalDisplayKm!==4.4||s.span?.pitch!==22||s.span?.firstIndex!==-4||s.span?.lastIndex!==32)throw new Error('Only the first bounded interstation layout is implemented');
 if(!Number.isInteger(s.object?.seed)||s.object.seed<0||s.object.seed>0xffffffff)throw new Error('Invalid deterministic route seed');
 if(JSON.stringify(s.layout?.frontZRange)!=='[-9.3,-7.6]'||s.layout?.bridgeSetbackZ!==-10.8||s.layout?.railHalfClearance!==1.6)throw new Error('Unsupported layout envelope');
 if(s.layout?.side!==-1||s.layout?.observerSide!==1||s.provenance?.externalMesh!==false||s.provenance?.externalImageTextures!==false)throw new Error('Invalid side or external assets');
 const p=s.streaming;for(const k of ['nearEnter','nearExit','midEnter','midExit','farEnter','farExit','maxActiveChunks','maxNearChunks','maxExpandedTriangles','maxGeometryBytes','maxBuildsPerFrame'])if(!Number.isFinite(p?.[k])||p[k]<=0)throw new Error('Invalid streaming budget '+k);
 for(const k of ['maxActiveChunks','maxNearChunks','maxExpandedTriangles','maxGeometryBytes','maxBuildsPerFrame'])if(!Number.isInteger(p[k]))throw new Error('Integer route budget '+k);
 if(!(p.nearEnter<p.nearExit&&p.nearExit<p.midEnter&&p.midEnter<p.midExit&&p.midExit<p.farEnter&&p.farEnter<p.farExit))throw new Error('LOD hysteresis ordering');
 if(p.maxActiveChunks>18||p.maxNearChunks>3||p.maxExpandedTriangles>600000||p.maxGeometryBytes>64000000||p.maxBuildsPerFrame>3)throw new Error('Route budget exceeds bounded implementation');
 const v=s.variation, choices={facades:['brick_shophouse','timber_verandah','plaster_recessed','masonry_pilaster','enclosed_balcony'],roofs:['flat_parapet','stepped_parapet','pitched_roof','corrugated_shed'],signShapes:['fascia','segmented','rounded','blade']};
 for(const [key,allowed]of Object.entries(choices))if(!Array.isArray(v?.[key])||v[key].length!==allowed.length||v[key].some(x=>!allowed.includes(x))||new Set(v[key]).size!==allowed.length)throw Error('Invalid variation '+key);
 if(!Array.isArray(v.signHeights)||v.signHeights.length!==4||v.signHeights.some(x=>!Number.isFinite(x)||x<.58||x>1.35))throw Error('Invalid sign heights');
 for(const key of ['plasterPalette','woodPalette'])if(!Array.isArray(v[key])||v[key].length<1||v[key].length>8||v[key].some(x=>!/^#[0-9a-f]{6}$/i.test(x)))throw Error('Invalid palette');
 for(const key of ['buildingAge','localRepair','cageDensity','signDensity'])if(!Array.isArray(v[key])||v[key].length!==2||v[key].some(x=>!Number.isFinite(x)||x<0||x>1)||v[key][0]>v[key][1])throw Error('Invalid variation range '+key);
 return structuredClone(s);
}
export function createRoutePlan(input,route){const s=validateRoute(input),a=route?.[0]?.target??0,b=route?.[1]?.target??700;if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(b-a-700)>.001)throw new Error('R20 requires unchanged 700m compressed first leg');
 return{score:s,start:a,end:b,bridge:(a+b)/2+5,chunks:Array.from({length:37},(_,n)=>{const index=n-4;return{id:'parcel-'+(index+4).toString().padStart(2,'0'),index,center:a+27+22*index,seed:(s.object.seed+Math.imul(index+5,104729))>>>0,anchor:index===0};})};}
export function resolveChunk(plan,chunk,anchor,detail='near'){
 const s=structuredClone(anchor);s.instrument.version='1.2.0';s.performance.detail=detail;s.performance.limits.maxTriangles=240000;
 const r=random(chunk.seed),v=plan.score.variation,range=(key)=>v[key][0]+r()*(v[key][1]-v[key][0]);s.object={id:chunk.id,label:'首站至油麻地原創商住街屋',seed:chunk.seed};
 const bridge=Math.abs(chunk.center-plan.bridge)<30,station=Math.min(Math.abs(chunk.center-plan.start),Math.abs(chunk.center-plan.end))<60;
 const widths=[6.8+r()*2.5,6.8+r()*2.5],gap=.28+r()*.55,left=-15.0;
 const floors=[2+Math.floor(r()*5),2+Math.floor(r()*5)];if(floors[0]+floors[1]>11)floors[1]=11-floors[0];
 const palettes=[['#b0aa91','#78503b','#344a40'],['#aca994','#755047','#43574a'],['#a6a79c','#806353','#415760'],['#c0b394','#694a3c','#685549']];const color=palettes[Math.floor(r()*palettes.length)];
 s.appearance={wetness:.22+r()*.20,saltExposure:.3+r()*.35,plasterTint:color[0],brickTint:color[1],woodTint:color[2]};
 s.construction.windowCageDensity=range('cageDensity');s.construction.signDensity=range('signDensity');s.construction.wireSag=.2+r()*.4;
 s.construction.buildings=widths.map((w,i)=>{const k=(chunk.index+4)*4+i*2,shops=[0,1].map(j=>{const t=ROUTE_TENANTS[k+j];r();return{id:t.id,text:t.text,type:t.shopType,signStyle:t.style,signAge:r()*.90,open:r()>.14,signShape:v.signShapes[(k+j+Math.floor(k/7))%4],signHeight:v.signHeights[(k+j)%4]};});
 return{id:chunk.id+'-b'+i,x:left+(i?widths[0]+gap:0)+w/2,frontZ:bridge?-10.8:station?-8.3-r()*.7:-7.6-r()*1.7,width:w,depth:4.6+r()*1.8,floors:floors[i],floorHeight:2.85+r()*.35,groundHeight:3.9+r()*.35,bays:w<7.3?2:3,facade:v.facades[((chunk.index+4)*2+i+Math.floor((chunk.index+4)/3))%5],age:range('buildingAge'),repair:range('localRepair'),roofProfile:v.roofs[(chunk.index+4+i*3)%4],plasterTint:v.plasterPalette[(chunk.index+4+i)%v.plasterPalette.length],woodTint:v.woodPalette[(chunk.index+4+i*2)%v.woodPalette.length],shops};});
 if(chunk.anchor){for(let i=0;i<2;i++){const b=s.construction.buildings[i],original=anchor.construction.buildings[i];for(const key of ['x','frontZ','width','depth','floors','floorHeight','groundHeight','bays'])b[key]=original[key];}}
 return s;
}
export function desiredChunks(plan,focus,previous=new Map()){
 const p=plan.score.streaming,targets=[];
 for(const c of plan.chunks){const d=Math.abs(c.center-8-focus),old=previous.get(c.id)?.detail;let detail=d<(old==='near'?p.nearExit:p.nearEnter)?'near':d<(old==='mid'?p.midExit:p.midEnter)?'mid':d<(old==='far'?p.farExit:p.farEnter)?'far':null;if(detail)targets.push({...c,detail,distance:d});}
 targets.sort((a,b)=>a.distance-b.distance);let near=0;for(const t of targets)if(t.detail==='near'&&++near>p.maxNearChunks)t.detail='mid';
 return targets.slice(0,p.maxActiveChunks);
}
