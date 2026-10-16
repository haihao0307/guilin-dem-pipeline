/** Authored GAME tunnel. Curved void and lining share route.sample/sections.
 * Terrain subtraction adapts the existing R03 render-cache half-space clipping
 * pattern to 3D convex sweeps. Source DEM, runway and floor samplers are untouched.
 * No third-party cave shader or private reference image is included.
 */
const EPS=1e-9;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a);if(l<EPS)throw Error('Tunnel frame is singular');return a.map(v=>v/l);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const finite=a=>a.every(Number.isFinite);
const area=p=>{let s=0;for(let i=1;i<p.length-1;i++)s+=Math.hypot(...cross(sub(p[i].a,p[0].a),sub(p[i+1].a,p[0].a)))/2;return s;};
const bounds=pts=>[0,1,2].map(k=>[Math.min(...pts.map(p=>p[k])),Math.max(...pts.map(p=>p[k]))]);
const overlaps=(a,b)=>a.every((v,k)=>v[1]>b[k][0]+EPS&&v[0]<b[k][1]-EPS);
export const DEFAULT_TUNNEL=Object.freeze({sectionId:'lion_rock',stepM:4,halfWidthM:4.5,springM:3.5,floorM:-.65,wallM:.45,archSegments:16,segmentOverlapM:.12,maxPortalExtensionM:1500,portalProbeStepM:5,portalFloorClearanceM:.10,portalExitCheckM:10});

/** Exact height on the retained background triangles, not a nearest DEM node.
 * Pure display query: does not replace hkHeight or edit any source samples.
 */
export function sampleBackgroundTriangle(HK,heights,mask,x,z){
 const cf=(x-(HK.x0-HK.origin[0]))/HK.step,rf=(z-(HK.origin[1]-HK.y0))/HK.step;
 if(cf<0||rf<0||cf>HK.width-1||rf>HK.height-1)return NaN;
 const c=Math.min(HK.width-2,Math.floor(cf)),r=Math.min(HK.height-2,Math.floor(rf)),u=cf-c,v=rf-r,j=r*HK.width+c,A=j,B=j+1,C=j+HK.width,D=C+1,ids=u+v<=1?[A,C,B]:[B,C,D];
 if(ids.some(i=>!Number.isFinite(heights[i])||mask&&mask[i]===0))return NaN;
 return u+v<=1?heights[A]+(heights[B]-heights[A])*u+(heights[C]-heights[A])*v:heights[D]+(heights[C]-heights[D])*(1-u)+(heights[B]-heights[D])*(1-v);
}

export function tunnelProfile(config=DEFAULT_TUNNEL,outer=false){
 const w=config.halfWidthM+(outer?config.wallM:0),floor=config.floorM-(outer?config.wallM:0),p=[[-w,floor],[w,floor],[w,config.springM]];
 for(let i=1;i<=config.archSegments;i++){const a=Math.PI*i/config.archSegments;p.push([Math.cos(a)*w,config.springM+Math.sin(a)*w]);}
 return p;
}
function pose(route,s){const q=route.sample(s);if(!q?.p||!q?.f||!finite(q.p)||!finite(q.f))throw Error('Tunnel requires finite route pose');const f=norm(q.f),r=norm([-f[2],0,f[0]]),up=norm(cross(r,f));return{p:q.p.slice(),f,r,up,s};}
function world(q,p){return q.p.map((v,k)=>v+q.r[k]*p[0]+q.up[k]*p[1]);}
function segmentVolume(a,b,profile,overlap){
 const f=norm(sub(b.p,a.p)),r=norm([-f[2],0,f[0]]),up=norm(cross(r,f)),length=Math.hypot(...sub(b.p,a.p));
 overlap+=Math.max(...profile.map(p=>Math.abs(p[0])))*Math.max(Math.abs(dot(a.r,f)),Math.abs(dot(b.r,f)));
 const planes=[{n:f,d:dot(f,a.p)-overlap},{n:f.map(v=>-v),d:-dot(f,b.p)-overlap}];
 for(let i=0;i<profile.length;i++){const p=profile[i],q=profile[(i+1)%profile.length],nx=-(q[1]-p[1]),ny=q[0]-p[0],n=r.map((v,k)=>v*nx+up[k]*ny);planes.push({n,d:dot(n,a.p)+nx*p[0]+ny*p[1]});}
 const rings=[a.p.map((v,k)=>v-f[k]*overlap),b.p.map((v,k)=>v+f[k]*overlap)].flatMap(p=>profile.map(v=>p.map((x,k)=>x+r[k]*v[0]+up[k]*v[1])));
 return{planes,bounds:bounds(rings),startS:a.s,endS:b.s,length};
}
function split(poly,plane){
 const inside=[],outside=[];let a=poly.at(-1),da=dot(plane.n,a.a)-plane.d;
 for(const b of poly){const db=dot(plane.n,b.a)-plane.d;
  if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db),p={a:mix(a.a,b.a,t),index:-1};inside.push(p);outside.push(p);}
  if(db>=0)inside.push(b);if(db<=0)outside.push(b);a=b;da=db;
 }return{inside,outside};
}
function subtract(poly,volume){
 let remaining=poly;const pieces=[];
 for(const plane of volume.planes){if(remaining.length<3)break;const halves=split(remaining,plane);if(halves.outside.length>=3&&area(halves.outside)>EPS)pieces.push(halves.outside);remaining=halves.inside;}
 if(remaining.length<3||area(remaining)<=EPS)return{changed:false,pieces:[poly]};
 return{changed:true,pieces};
}
export function createTunnelSweep(route,options={}){
 const config={...DEFAULT_TUNNEL,...options};
 if(!route?.sample||!Array.isArray(route.sections))throw Error('Tunnel needs route.sample and route.sections');
 const section=route.sections.find(s=>s.id===config.sectionId&&s.role==='tunnel');if(!section)throw Error('Missing declared tunnel section '+config.sectionId);
 for(const k of['stepM','halfWidthM','springM','wallM','archSegments'])if(!(config[k]>0))throw Error('Invalid tunnel parameter '+k);
 let startS=section.startS,endS=section.endS;const portalStatus={resolved:false,sourceSection:[startS,endS],designLabel:'authored_game_geometry_not_historical_or_engineering_certification'};
 let samples=[],volumes=[],grid=new Map(),allBounds=null,clipRecords=[],groundSampler=null,portalS=[startS,endS],coveredRuns=[],openRuns=[];
 const cellM=64,key=(x,z)=>x+','+z;
 function rebuild(){
  const core=portalStatus.railVisibilityInterval||[startS,endS],count=Math.ceil((core[1]-core[0])/config.stepM),chainages=new Set([startS,endS,...portalS]);for(let i=0;i<=count;i++)chainages.add(core[0]+(core[1]-core[0])*i/count);for(let s=core[0]-config.stepM;s>startS;s-=config.stepM)chainages.add(s);for(let s=core[1]+config.stepM;s<endS;s+=config.stepM)chainages.add(s);samples=[...chainages].sort((a,b)=>a-b).map(s=>pose(route,s));
  const profile=tunnelProfile(config,true),covered=samples.slice(1).map((b,i)=>{const q=pose(route,(samples[i].s+b.s)/2),h=groundSampler?.(q.p[0],q.p[2]);return !groundSampler||(Number.isFinite(h)&&h>=world(q,[0,config.springM+config.halfWidthM+config.wallM])[1]-.35);});
  function runs(value){const out=[];let start=null;for(let i=0;i<covered.length;i++){if(covered[i]===value&&start===null)start=i;if(start!==null&&(covered[i]!==value||i===covered.length-1)){const end=covered[i]===value?i+1:i;out.push([start,end]);start=null;}}return out;}
  coveredRuns=runs(true);openRuns=runs(false);
  volumes=samples.slice(1).map((b,i)=>{const a=samples[i];let shape=profile;if(!covered[i]&&groundSampler){const height=Math.max(...[a,b].flatMap(q=>[-1,0,1].map(side=>{const p=world(q,[side*(config.halfWidthM+config.wallM),0]),h=groundSampler(p[0],p[2]);return Number.isFinite(h)?h-q.p[1]+2:config.springM+config.halfWidthM+2;}))),w=config.halfWidthM+config.wallM;const top=Math.max(10000,height);shape=[[-w,config.floorM-config.wallM],[w,config.floorM-config.wallM],[w,top],[-w,top]];}return segmentVolume(a,b,shape,config.segmentOverlapM);});grid=new Map();
  if(groundSampler){portalStatus.coveredIntervals=coveredRuns.map(([a,b])=>[samples[a].s,samples[b].s]);portalStatus.openCuttingIntervals=openRuns.map(([a,b])=>[samples[a].s,samples[b].s]);portalStatus.geometryPortals=coveredRuns.flatMap(([a,b])=>[a,b].map(i=>terrainAt(groundSampler,samples[i].s)));portalStatus.longestOpenCuttingM=Math.max(0,...openRuns.map(([a,b])=>samples[b].s-samples[a].s));portalStatus.coveredComponents=coveredRuns.length;portalStatus.mainCoveredInterval=portalStatus.coveredIntervals.reduce((a,b)=>!a||b[1]-b[0]>a[1]-a[0]?b:a,null);if(coveredRuns.length)portalStatus.portalChainages=[samples[coveredRuns[0][0]].s,samples[coveredRuns.at(-1)[1]].s];}
  for(let i=0;i<volumes.length;i++){const b=volumes[i].bounds;for(let x=Math.floor(b[0][0]/cellM);x<=Math.floor(b[0][1]/cellM);x++)for(let z=Math.floor(b[2][0]/cellM);z<=Math.floor(b[2][1]/cellM);z++){const k=key(x,z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}}
  allBounds=[0,1,2].map(k=>[Math.min(...volumes.map(v=>v.bounds[k][0])),Math.max(...volumes.map(v=>v.bounds[k][1]))]);
 }
 function candidates(b){if(!overlaps(b,allBounds))return[];const ids=new Set();for(let x=Math.floor(b[0][0]/cellM);x<=Math.floor(b[0][1]/cellM);x++)for(let z=Math.floor(b[2][0]/cellM);z<=Math.floor(b[2][1]/cellM);z++)for(const id of grid.get(key(x,z))||[])if(overlaps(b,volumes[id].bounds))ids.add(id);return[...ids].map(i=>volumes[i]);}
 function terrainAt(sampleHeight,s){const p=pose(route,s),h=sampleHeight(p.p[0],p.p[2]);return{chainageM:s,terrainM:Number.isFinite(h)?h:null,railM:p.p[1],crownM:world(p,[0,config.springM+config.halfWidthM+config.wallM])[1],position:p.p};}
 function resolvePortals(sampleHeight,{extend=true,samplerPolicy='caller_supplied_terrain_query'}={}){
  if(clipRecords.length)throw Error('Resolve tunnel portals before any terrain clipping');
  groundSampler=sampleHeight;portalStatus.samplerPolicy=samplerPolicy;portalStatus.openCuttingTopPolicy='vertically_open_excavation_10km_numeric_ceiling';portalStatus.endpointPolicy='full_cut_width_below_inner_floor_with_outward_check';const ends=[],crowns=[],railEnds=[];
  const floorExit=(s,dir)=>{let minClearanceM=Infinity,maxCrossSectionGroundAboveFloorM=-Infinity,sampleCount=0;const width=config.halfWidthM+config.wallM;for(let d=0;d<=config.portalExitCheckM;d+=1){const at=s+dir*d;if(at<0||at>route.length)return{exposed:false,minClearanceM:null};const q=pose(route,at);for(let i=0;i<=10;i++){const p=world(q,[-width+2*width*i/10,config.floorM]),h=sampleHeight(p[0],p[2]);if(!Number.isFinite(h))return{exposed:false,minClearanceM:null};minClearanceM=Math.min(minClearanceM,p[1]-h);if(d===0)maxCrossSectionGroundAboveFloorM=Math.max(maxCrossSectionGroundAboveFloorM,h-p[1]);sampleCount++;}}return{exposed:minClearanceM>=config.portalFloorClearanceM,minClearanceM,maxCrossSectionGroundAboveFloorM,outwardCheck:{distanceM:config.portalExitCheckM,stepM:1,lateralSamples:11,sampleCount,maxGroundAboveFloorM:-minClearanceM}};};
  for(const [s,dir]of[[section.startS,-1],[section.endS,1]]){let q=terrainAt(sampleHeight,s),distance=0,crown=null;
   while(true){if(crown===null&&q.terrainM!==null&&q.terrainM<=q.crownM-.35)crown={...q};
    if(!extend||q.terrainM===null||q.terrainM<=q.railM+.35||distance>=config.maxPortalExtensionM)break;
    distance+=config.portalProbeStepM;const d=Math.max(0,Math.min(route.length,s+dir*distance));q=terrainAt(sampleHeight,d);if(d===0||d===route.length)break;
   }
   railEnds.push(q.chainageM);let exit=floorExit(q.chainageM,dir);while(extend&&!exit.exposed&&q.terrainM!==null&&distance<config.maxPortalExtensionM){distance=Math.min(config.maxPortalExtensionM,distance+config.portalProbeStepM);const d=Math.max(0,Math.min(route.length,s+dir*distance));q=terrainAt(sampleHeight,d);exit=floorExit(q.chainageM,dir);if(d===0||d===route.length)break;}
   ends.push({...q,coverAboveRailM:q.terrainM===null?null:q.terrainM-q.railM,extensionM:Math.abs(q.chainageM-s),exposed:exit.exposed,floorClearanceM:exit.minClearanceM,maxCrossSectionGroundAboveFloorM:exit.maxCrossSectionGroundAboveFloorM??null,requiredGroundBelowFloorM:config.portalFloorClearanceM,outwardCheck:exit.outwardCheck??null,checkedOutwardM:config.portalExitCheckM,checkedHalfWidthM:config.halfWidthM+config.wallM});crowns.push(crown);
  }
  portalStatus.railVisibilityInterval=railEnds;startS=ends[0].chainageM;endS=ends[1].chainageM;portalS=crowns.map((q,i)=>q?.chainageM??[startS,endS][i]);
  Object.assign(portalStatus,{resolved:ends.every(q=>q.exposed)&&crowns.every(Boolean),ends,crownCrossings:crowns,portalChainages:portalS,autoExtended:extend,renderInterval:[startS,endS],searchLimitPerEndM:config.maxPortalExtensionM,status:ends.every(q=>q.exposed)&&crowns.every(Boolean)?'open_portals_with_approach_cuttings':'blocked_no_exposed_entrance_in_search_range'});rebuild();return structuredClone(portalStatus);
 }
 function clipTerrain(positions,indices,stride=7,label='terrain'){
  if(positions.length%stride||indices.length%3||stride<3)throw Error('Invalid terrain indexed buffer');
  if(portalStatus.status&&!portalStatus.resolved)return{positions:new Float32Array(positions),indices:Uint32Array.from(indices),stats:{blocked:true,sourceBuffersUnmodified:true}};
  const appended=[],out=[],vertices=positions.length/stride,stats={label,sourceTriangles:indices.length/3,outputTriangles:0,clippedTriangles:0,fullyRemovedTriangles:0,candidateTriangles:0,removedSurfaceAreaM2:0,appendedVertices:0,sourceBuffersUnmodified:true};
  for(let t=0;t<indices.length;t+=3){const i0=indices[t],i1=indices[t+1],i2=indices[t+2],a=i0*stride,b=i1*stride,c=i2*stride;
   let far=false;for(let k=0;k<3;k++)if(Math.max(positions[a+k],positions[b+k],positions[c+k])<=allBounds[k][0]||Math.min(positions[a+k],positions[b+k],positions[c+k])>=allBounds[k][1]){far=true;break;}if(far){out.push(i0,i1,i2);continue;}
   const ids=[i0,i1,i2],xyz=ids.map(i=>[positions[i*stride],positions[i*stride+1],positions[i*stride+2]]),vs=candidates(bounds(xyz));
   if(!vs.length){out.push(...ids);continue;}stats.candidateTriangles++;
   let pieces=[ids.map(i=>({a:Array.from(positions.slice(i*stride,(i+1)*stride)),index:i}))],changed=false;const originalArea=area(pieces[0]);
   for(const v of vs){const next=[];for(const p of pieces){const cut=subtract(p,v);changed||=cut.changed;next.push(...cut.pieces);}pieces=next;if(!pieces.length)break;}
   if(!changed){out.push(...ids);continue;}stats.clippedTriangles++;if(!pieces.length)stats.fullyRemovedTriangles++;
   const cache=new Map();const index=p=>{if(p.index>=0)return p.index;const k=p.a.slice(0,3).join(',');if(cache.has(k))return cache.get(k);const i=vertices+appended.length/stride;appended.push(...p.a);cache.set(k,i);return i;};
   let kept=0;for(const p of pieces){kept+=area(p);for(let j=1;j<p.length-1;j++)if(area([p[0],p[j],p[j+1]])>EPS)out.push(index(p[0]),index(p[j]),index(p[j+1]));}stats.removedSurfaceAreaM2+=Math.max(0,originalArea-kept);
  }
  const output=new Float32Array(positions.length+appended.length);output.set(positions);output.set(appended,positions.length);stats.outputTriangles=out.length/3;stats.appendedVertices=appended.length/stride;clipRecords.push(stats);return{positions:output,indices:Uint32Array.from(out),stats};
 }
 function contains(point){return candidates(bounds([point.map(v=>v-1e-6),point.map(v=>v+1e-6)])).some(v=>v.planes.every(p=>dot(p.n,point)-p.d>=-EPS));}
 function meshData(){
  if(portalStatus.status&&!portalStatus.resolved)return{positions:new Float32Array(),colors:new Float32Array(),indices:new Uint32Array(),parts:{inner:0,outer:0,portals:0,approach:0},rings:0,profileVertices:0,openEndCaps:true,blocked:true};
  const inner=tunnelProfile(config),outer=tunnelProfile(config,true),n=inner.length,positions=[],colors=[],indices=[],partCounts={inner:0,outer:0,portals:0,approach:0};let ringCount=0;
  const add=(a,b,c,kind)=>{indices.push(a,b,c);partCounts[kind]++;};
  for(const [start,end]of coveredRuns){const tubeSamples=samples.slice(start,end+1),offset=positions.length/3;ringCount+=tubeSamples.length;
   for(const q of tubeSamples)for(const profile of[inner,outer])for(let j=0;j<n;j++){positions.push(...world(q,profile[j]));const floor=j<2,c=profile===inner?(floor?[.23,.24,.23]:[.37,.37,.34]):[.29,.30,.27];colors.push(...c);}
   for(let s=0;s<tubeSamples.length-1;s++)for(let j=0;j<n;j++){const k=(j+1)%n,a=offset+s*2*n+j,b=offset+s*2*n+k,c=offset+(s+1)*2*n+j,d=offset+(s+1)*2*n+k;add(a,c,b,'inner');add(b,c,d,'inner');add(a+n,b+n,c+n,'outer');add(b+n,d+n,c+n,'outer');}
   for(const s of[0,tubeSamples.length-1]){const q=tubeSamples[s],collar=positions.length/3;
    // Close the new vertical excavation face above and beside the arch, up to
    // actual source terrain. The doorway itself stays open; this is not a cap.
    for(let j=0;j<n;j++){const p=outer[j].slice();if(j>=2&&groundSampler){const at=world(q,[p[0],0]),h=groundSampler(at[0],at[2]);if(Number.isFinite(h))p[1]=Math.max(p[1],(h-q.p[1])/(q.up[1]||1)+.08);}positions.push(...world(q,p));colors.push(.40,.39,.35);}
    for(let j=0;j<n;j++){const k=(j+1)%n,a=offset+s*2*n+j,b=offset+s*2*n+k,c=collar+j,d=collar+k;if(s===0){add(a,b,c,'portals');add(b,d,c,'portals');}else{add(a,c,b,'portals');add(b,c,d,'portals');}}
   }
  }
  // Roofless, terrain-height retaining walls link a genuinely exposed rail to each
  // arch portal. This avoids an artificial above-ground concrete pipe approach.
  const wallTop=(q,side)=>{const p=world(q,[side*config.halfWidthM,0]),h=groundSampler?.(p[0],p[2]);return Math.max(config.floorM+.15,Number.isFinite(h)?h-q.p[1]+.2:config.springM);};
  for(const [start,end]of openRuns){const approach=samples.slice(start,end+1);
   const offset=positions.length/3;
   for(const q of approach){const L=wallTop(q,-1),R=wallTop(q,1),w=config.halfWidthM,t=config.wallM;for(const p of[[-w,L],[-w,config.floorM],[w,config.floorM],[w,R],[w+t,R],[w+t,config.floorM-t],[-w-t,config.floorM-t],[-w-t,L]]){positions.push(...world(q,p));colors.push(.34,.34,.31);}}
   for(let i=0;i<approach.length-1;i++)for(let j=0;j<8;j++){const k=(j+1)%8,a=offset+i*8+j,b=offset+i*8+k,c=a+8,d=b+8;add(a,c,b,'approach');add(b,c,d,'approach');}
  }
  return{positions:Float32Array.from(positions),colors:Float32Array.from(colors),indices:Uint32Array.from(indices),parts:partCounts,rings:ringCount,profileVertices:n,openEndCaps:true,approachType:'roofless_actual_terrain_height_cuttings'};
 }
 rebuild();
 return{route,config,section,resolvePortals,clipTerrain,contains,meshData,sampleBackgroundTriangle,get samples(){return samples;},get interval(){return[startS,endS];},stats(){return{schema:'kaopu.curved-terrain-tunnel/1',sectionId:section.id,routeLengthM:route.length,renderInterval:[startS,endS],lengthM:endS-startS,curveSamples:samples.length,convexSweeps:volumes.length,profile:config,portals:structuredClone(portalStatus),terrainCaches:clipRecords.map(s=>({...s})),removedSurfaceAreaM2:clipRecords.reduce((a,b)=>a+b.removedSurfaceAreaM2,0),sourceHeightsChanged:false,runwayChanged:false,trainAndLiningShareRoute:true,legacyRadiusCutaway:false,geometryRole:'authored_game_tunnel_not_surveyed_engineering',collisionModel:'route_constrained_train; source_terrain_sampler_remains_original'}}};
}

export function installTunnelTerrain(route,{target=globalThis,...options}={}){const sweep=createTunnelSweep(route,options);target.HKLionRockTunnel=sweep;return sweep;}

export function patchTunnelTerrainHost(html){
 const once=(a,b)=>{if(html.split(a).length!==2)throw Error('Tunnel host anchor not unique: '+a.slice(0,90));html=html.replace(a,b);};
 const coast='const hkMeshData=hkMesh(hkCoastClosed.positions,hkCoastClosed.indices,7);',cedd='const hkMeshData=hkMesh(hkClippedIncrement.positions,hkClippedIncrement.indices,7);';
 const matches=[coast,cedd].filter(anchor=>html.split(anchor).length===2);if(matches.length!==1)throw Error('Tunnel needs exactly one final coast/CEDD terrain cache anchor');
 const source=matches[0]===coast?'hkCoastClosed':'hkClippedIncrement';
 once(matches[0],`window.HKLionRockTunnel.resolvePortals((x,z)=>{const detail=sampleDetail(x,z);return detail!==null?detail:window.HKLionRockTunnel.sampleBackgroundTriangle(HK,hkHeights,hkMask,x,z);},{samplerPolicy:"source_detail_triangles_and_background_triangles"});const hkTunnelCache=window.HKLionRockTunnel.clipTerrain(${source}.positions,${source}.indices,7,"background-and-coast");const hkMeshData=hkMesh(hkTunnelCache.positions,hkTunnelCache.indices,7);`);
 once('return hkMesh(vs,ix,7)}','const tunnelCache=window.HKLionRockTunnel.clipTerrain(vs,ix,7,"detail-"+l.step+"m");return hkMesh(tunnelCache.positions,tunnelCache.indices,7)}');
 once('if(uTrackCut>0.5&&distance(p.xz,uTrackFocus.xz)<180.&&p.y>uTrackFocus.y+1.)discard;','');
 return html;
}

export function installTunnelScene(game,{tunnel=globalThis.HKLionRockTunnel,target=globalThis}={}){
 if(!tunnel||!game.attachRouteScene)throw Error('Tunnel needs prepared terrain cache and shared route scene');
 for(const s of tunnel.interval){const a=game.route.sample(s),b=tunnel.route.sample(s);if(Math.hypot(...sub(a.p,b.p))>1e-5)throw Error('Tunnel and train route spectra differ');}
 if(!tunnel.stats().portals.resolved){const blocked={ready:false,stats:()=>tunnel.stats()};target.HKLionRockTunnelScene=blocked;return blocked;}
 let root,stats;game.attachRouteScene(({THREE,scene,requestFrame})=>{
  const data=tunnel.meshData(),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  root=new THREE.Group();root.name='R06 curved Lion Rock tunnel: real terrain void and open lining';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0,side:THREE.DoubleSide,emissive:0x28251e,emissiveIntensity:.35});const liner=new THREE.Mesh(geometry,material);liner.name='curved inner walls, roof, floor and annular portal rims';root.add(liner);scene.add(root);
  const lights=0; // Low emissive lining keeps the bore legible without adding global scene lights.
  stats={...data.parts,rings:data.rings,triangles:data.indices.length/3,openEndCaps:data.openEndCaps,lights,rendered:true};requestFrame();
 });
 const originalSample=game.route.sample,covered=tunnel.stats().portals.coveredIntervals;const tunnelSample=d=>{const q=originalSample(d);return covered.some(([a,b])=>d>=a&&d<=b)?{...q,role:'tunnel',sourceSectionId:q.sectionId,sectionId:tunnel.section.id,actualTunnelLining:true}:q;};game.route.sample=tunnelSample;
 const api={ready:true,root,tunnel,stats:()=>({...tunnel.stats(),render:stats,coveredRouteRoleAdapted:true}),setVisible(v){root.visible=!!v;},dispose(){if(game.route.sample===tunnelSample)game.route.sample=originalSample;root.parent?.remove(root);root.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});}};target.HKLionRockTunnelScene=api;return api;
}
