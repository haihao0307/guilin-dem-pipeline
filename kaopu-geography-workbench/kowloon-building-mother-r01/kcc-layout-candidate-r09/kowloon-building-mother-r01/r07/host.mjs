/**
 * R06 pure semantic/source anchor. No rendering engine, surface construction,
 * or authoritative inferred interior. Coordinates and distances are metres.
 * Observed-derived exterior provenance is kept distinct from editable design.
 */
export const HOST_SCHEMA = 'kaopu.implicit-building-host/0.1';
export const SOURCE_COMMIT = 'b74929fc9f1c81eaa7e4b529a6bd5361024b035b';
export const SOURCE_MODEL_ID = 'B359971994401063C0';
const SOURCE_ROOT = 'kaopu-geography-workbench/hk-three-buildings-r01/geometry';
const REPOSITORY = 'haihao0307/guilin-dem-pipeline';
const BASE_M = 0.00000191;
const ROOF_M = 70.20300293;
const SOURCE_ORIGIN = [836004.8125, 819943.3125, 20.641998291015625];
const FOOTPRINT = [[-6.08203125,5.83984375],[-12.23828125,3.45703125],[-9.83203125,-2.69140625],[-3.64453125,-0.28515625],[-3.20703125,-1.47265625],[-9.22265625,-4.21484375],[-6.94140625,-10.03515625],[-0.43359375,-7.52734375],[2.81640625,-15.96484375],[8.54296875,-13.59765625],[5.29296875,-5.41015625],[12.23828125,-2.74609375],[10.06640625,3.09765625],[2.99609375,0.37109375],[2.35546875,2.08984375],[9.30078125,4.87890625],[6.55078125,10.98046875],[-0.13671875,8.26171875],[-3.08203125,15.96484375],[-9.08203125,13.71484375]];
const SERVICE_RESERVE = [[-1,-1],[1,-1],[1,1],[-1,1]];
const EPS = 1e-8;
const clone = value => structuredClone(value);
const finite = (n, label) => {if (!Number.isFinite(n)) throw Error(`${label} must be finite`); return n;};
const pair = (p, label) => {
  if (!Array.isArray(p) || p.length !== 2) throw Error(`${label} must contain two numbers`);
  return p.map((n, i) => finite(n, `${label}[${i}]`));
};
const vector = (p, label) => {
  if (!Array.isArray(p) || p.length !== 3) throw Error(`${label} must contain three numbers`);
  return p.map((n, i) => finite(n, `${label}[${i}]`));
};

export function defaultHostConfig() {
  return {firstSlabOffset: 3.2, floorHeight: 3.2, slabThickness: 0.2,
    originEastNorth: [3,-8], runEastNorth: [3.25,-8.4375],
    flightWidth: 1.2, centerGap: 0.2, treadDepth: 0.28, landingDepth: 1.2,
    targetRiser: 0.16, risersPerFlight: null, partitionWidth: 2.6, partitionThickness: 0.12,
    partitionHeight: 2.5, doorWidth: 0.9, doorHeight: 2.1,
    lowerFloorId: 'floor-001', upperFloorId: 'floor-002'};
}

function normalizeConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Host configuration must be an object');
  const defaults = defaultHostConfig();
  for (const key of Object.keys(input)) if (!(key in defaults)) throw Error(`Unknown host parameter: ${key}`);
  const c = {...defaults, ...clone(input)};
  for (const key of Object.keys(defaults).filter(k => typeof defaults[k] === 'number')) finite(c[key], key);
  c.originEastNorth = pair(c.originEastNorth, 'originEastNorth'); c.runEastNorth = pair(c.runEastNorth, 'runEastNorth');
  if (c.lowerFloorId !== 'floor-001' || c.upperFloorId !== 'floor-002') throw Error('R06 is explicitly bounded to stable floor-001 and floor-002 IDs');
  if (Math.hypot(...c.runEastNorth) < EPS) throw Error('Run direction must be nonzero');
  if(c.risersPerFlight!==null&&(!Number.isInteger(c.risersPerFlight)||c.risersPerFlight<2||c.risersPerFlight>32))throw Error('risersPerFlight must be null or an integer 2–32');
  const ranges = {firstSlabOffset:[0.1,10],floorHeight:[2.4,4.8],slabThickness:[0.08,0.4],
    flightWidth:[0.6,2.5],centerGap:[0.05,1],treadDepth:[0.2,0.4],landingDepth:[0.6,3.5],
    targetRiser:[0.1,0.22],partitionWidth:[1.2,4],partitionThickness:[0.06,0.3],
    partitionHeight:[2,3.5],doorWidth:[0.5,2],doorHeight:[1.8,3]};
  for (const [key,[lo,hi]] of Object.entries(ranges)) if (c[key]<lo || c[key]>hi) throw Error(`${key} is outside the authored trial bounds, not a building standard`);
  if (c.slabThickness>=c.floorHeight || c.landingDepth<c.flightWidth) throw Error('Slab/landing dimensions cannot fit the bounded layout');
  if (c.doorWidth+0.2>=c.partitionWidth || c.doorHeight+0.1>=c.partitionHeight) throw Error('Door aperture must leave positive side and head material');
  return c;
}

/** A rigid, right-handed frame. Field x=lateral, y=up, z=run. */
export function createHostFrame(input = {}) {
  const c = normalizeConfig(input), length = Math.hypot(...c.runEastNorth), u=c.runEastNorth.map(n=>n/length), v=[-u[1],u[0]];
  const lowerFFL = BASE_M+c.firstSlabOffset+c.slabThickness;
  const origin=[c.originEastNorth[0],lowerFFL,-c.originEastNorth[1]], xAxis=[v[0],0,-v[1]], yAxis=[0,1,0], zAxis=[u[0],0,-u[1]];
  return {schema:'kaopu.rigid-host-frame/0.1', units:'metre', fieldAxes:['lateral','up-from-floor-001','run'], hostAxes:['east','up','south'],
    origin, xAxis, yAxis, zAxis,
    matrixColumnMajor:[...xAxis,0,...yAxis,0,...zAxis,0,...origin,1],
    scale:1, sourceBasis:'R05 authored origin; direction parallel to observed-derived wall p002',
    locationEvidence:'authored_interior_location_not_measured'};
}
function checkedFrame(frame) {
  if (frame?.schema!=='kaopu.rigid-host-frame/0.1') throw Error('A rigid host frame is required');
  const axes=[frame.xAxis,frame.yAxis,frame.zAxis].map((v,i)=>vector(v,`frame axis ${i}`)); vector(frame.origin,'frame origin');
  const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
  if (axes.some(a=>Math.abs(dot(a,a)-1)>1e-8) || Math.abs(dot(axes[0],axes[1]))>1e-8 || Math.abs(dot(axes[0],axes[2]))>1e-8 || Math.abs(dot(axes[1],axes[2]))>1e-8 || frame.scale!==1) throw Error('Material/field coordinates require a unit rigid transform');
  const [a,b,c]=axes, det=a[0]*(b[1]*c[2]-b[2]*c[1])-b[0]*(a[1]*c[2]-a[2]*c[1])+c[0]*(a[1]*b[2]-a[2]*b[1]);
  if (Math.abs(det-1)>1e-8) throw Error('Host frame must be right-handed');
  return frame;
}
export function transformLocalToHost(point, frame=createHostFrame()) {
  checkedFrame(frame); vector(point,'field point');
  return frame.origin.map((o,i)=>o+frame.xAxis[i]*point[0]+frame.yAxis[i]*point[1]+frame.zAxis[i]*point[2]);
}
export function transformHostToLocal(point, frame=createHostFrame()) {
  checkedFrame(frame); vector(point,'host point'); const d=point.map((n,i)=>n-frame.origin[i]);
  return [frame.xAxis,frame.yAxis,frame.zAxis].map(a=>a.reduce((s,n,i)=>s+n*d[i],0));
}
export function transformLocalToSurvey(point, frame=createHostFrame()) {
  const [east,up,south]=transformLocalToHost(point,frame);
  return [SOURCE_ORIGIN[0]+east,SOURCE_ORIGIN[1]-south,SOURCE_ORIGIN[2]+up];
}

export function createHostRecord(input = {}) {
  const frame=createHostFrame(input), originEUS=[SOURCE_ORIGIN[0],SOURCE_ORIGIN[2],-SOURCE_ORIGIN[1]];
  return {schema:HOST_SCHEMA, modelId:SOURCE_MODEL_ID, units:'metre',
    source:{repository:REPOSITORY,commit:SOURCE_COMMIT,scorePath:`${SOURCE_ROOT}/${SOURCE_MODEL_ID}.score.json`,
      scoreSha256:'5b4129d62103487a1821fcf69a8a7fa0d4903b390bb0dac771466e7acf9b2ce7',
      sourceUrl:`https://github.com/${REPOSITORY}/blob/${SOURCE_COMMIT}/${SOURCE_ROOT}/${SOURCE_MODEL_ID}.score.json`,
      provenancePath:`${SOURCE_ROOT}/${SOURCE_MODEL_ID}.provenance.json`,tile:'11-NW-20A',
      originalFileSha256:{gltf:'715e3f0ec1e70a41f4a1a7ac2abdbb8c8ff615045843965862cc7dd72964b29f',bin:'b83852afddb404a50c3e9f1856c465248a407cace58835b3d550b6ae7899013f'},
      attribution:'HKSAR Government, Lands Department / CSDI Portal',
      terms:'https://portal.csdi.gov.hk/csdi-webpage/doc/TNC'},
    georeference:{horizontalCrs:'EPSG:2326',verticalDatum:'Hong Kong Principal Datum',originEastingNorthingHeight:clone(SOURCE_ORIGIN),
      hostToSurveyDisplayMatrixColumnMajor:[1,0,0,0,0,1,0,0,0,0,1,0,...originEUS,1]},
    measuredExterior:{evidence:'observed_derived',footprintPatchId:'p000',footprintEastNorth:clone(FOOTPRINT),baseM:BASE_M,roofM:ROOF_M,
      wallPatchCount:20,actualUse:'unknown',name:'unknown',floorCount:'unknown'},
    reservedServiceVoid:{id:'reserved-core-volume-001',footprintEastNorth:clone(SERVICE_RESERVE),evidence:'R03/R05 authored reserve; not an observed core or lift'},
    designFrame:frame, fieldToSurveyDisplayMatrixColumnMajor:frame.matrixColumnMajor.map((n,i)=>i>=12&&i<=14?n+originEUS[i-12]:n),
    interiorEvidence:'unknown',editableProposal:true,realInteriorVerified:false,buildingComplianceVerified:false,
    safetyOrStructuralCertification:false,sourceExteriorMutated:false};
}

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(p,a,b)=>Math.abs(cross(a,b,p))<=EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
function inside(p,ring) {
  let result=false;
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(on(p,a,b))return 0;
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}
  return result?1:-1;
}
function meets(a,b,c,d) {
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  return (x>EPS&&y< -EPS||x< -EPS&&y>EPS)&&(z>EPS&&w< -EPS||z< -EPS&&w>EPS)||on(a,c,d)||on(b,c,d)||on(c,a,b)||on(d,a,b);
}
const ringsMeet=(a,b)=>a.some((p,i)=>b.some((q,j)=>meets(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));
const overlap=(a,b)=>ringsMeet(a,b)||inside(a[0],b)>=0||inside(b[0],a)>=0;
function ring(input) {
  if(!Array.isArray(input)||input.length<3||input.length>128)throw Error('Domain needs 3–128 local X/Z boundary points');
  const p=input.map((v,i)=>pair(v,`domain ${i}`));
  let area=0;
  for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<EPS)throw Error('Domain has zero-length edge');
    area+=a[0]*b[1]-b[0]*a[1];for(let j=i+1;j<p.length;j++){if(j===i+1||i===0&&j===p.length-1)continue;if(meets(a,b,p[j],p[(j+1)%p.length]))throw Error('Domain must be simple');}}
  if(Math.abs(area)<EPS)throw Error('Domain must enclose positive area');return p;
}
function segmentDistance(p,a,b) {
  const d=b.map((n,i)=>n-a[i]),t=Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/(d[0]*d[0]+d[1]*d[1])));
  return Math.hypot(p[0]-a[0]-t*d[0],p[1]-a[1]-t*d[1]);
}
const boundaryDistance=(a,b)=>Math.min(...a.flatMap((p,i)=>b.flatMap((q,j)=>[segmentDistance(p,q,b[(j+1)%b.length]),segmentDistance(q,p,a[(i+1)%a.length])])));

/** Whole-polygon containment, including concave boundary crossings and reserve enclosure. */
export function validateHostDomain(localRingXZ, frame=createHostFrame(), {excludeServiceReserve=true}={}) {
  const local=ring(localRingXZ), footprint=local.map(([x,z])=>{const [e,,s]=transformLocalToHost([x,0,z],frame);return [e,-s];});
  if(footprint.some(p=>inside(p,FOOTPRINT)!==1)||ringsMeet(footprint,FOOTPRINT))throw Error('Complete proposed domain must remain strictly inside the exact observed-derived footprint');
  if(excludeServiceReserve&&overlap(footprint,SERVICE_RESERVE))throw Error('Proposed domain intersects or encloses the existing authored service reserve');
  return {valid:true,localRingXZ:local,hostFootprintEastNorth:footprint,minimumExteriorBoundaryDistanceM:boundaryDistance(footprint,FOOTPRINT),
    serviceReserveClearanceM:excludeServiceReserve?boundaryDistance(footprint,SERVICE_RESERVE):null,
    basis:'whole polygon containment and segment crossings, not corner-only checks',sourceFootprintPatchId:'p000'};
}

/** Semantic identity survives changes to field shape or display backend. */
export function deriveHostGraph(input={}) {
  const c=normalizeConfig(input), host=createHostRecord(c), frame=host.designFrame;
  const lowerFFL=frame.origin[1],upperFFL=lowerFFL+c.floorHeight,midFFL=(lowerFFL+upperFFL)/2;
  const risersPerFlight=c.risersPerFlight??Math.ceil(c.floorHeight/(2*c.targetRiser)-EPS), actualRiser=c.floorHeight/(2*risersPerFlight), runLength=(risersPerFlight-1)*c.treadDepth;
  const width=2*c.flightWidth+c.centerGap,totalLength=2*c.landingDepth+runLength;
  if(c.slabThickness+EPS<actualRiser)throw Error('Upper slab must close the final riser in this bounded relation');
  if(upperFFL+c.partitionHeight>=ROOF_M)throw Error('Proposed partition exceeds the measured roof');
  const stairDomain=validateHostDomain([[-width/2,0],[width/2,0],[width/2,totalLength],[-width/2,totalLength]],frame);
  const partitionDomain=validateHostDomain([[-c.partitionWidth/2,-c.partitionThickness/2],[c.partitionWidth/2,-c.partitionThickness/2],[c.partitionWidth/2,c.partitionThickness/2],[-c.partitionWidth/2,c.partitionThickness/2]],frame);
  const floors=[{id:c.lowerFloorId,slabId:'slab-001',fflM:lowerFFL,sslM:lowerFFL,localY:0},{id:c.upperFloorId,slabId:'slab-002',fflM:upperFFL,sslM:upperFFL,localY:c.floorHeight}].map(f=>({...f,ownerId:SOURCE_MODEL_ID,evidence:'authored_FFL_not_surveyed',slabThicknessM:c.slabThickness}));
  const coreId='design-circulation-core-001',stairId='stair-001-002',railId=`${stairId}:continuous-rail`,partitionId='floor-002:proposed-partition',doorOpeningId=`${partitionId}:door-opening`,stairOpeningId=`${stairId}:upper-slab-opening`;
  const nodes=[{id:SOURCE_MODEL_ID,kind:'building',ownerId:null,evidence:'observed_derived_exterior_unknown_interior'},
    ...floors.map(f=>({...f,kind:'floor'})),...floors.map(f=>({id:f.slabId,kind:'slab-field',ownerId:f.id,hostFloorId:f.id,topLocalY:f.localY,bottomLocalY:f.localY-c.slabThickness})),
    {id:coreId,kind:'proposed-circulation-core',ownerId:SOURCE_MODEL_ID,referencedFloorIds:floors.map(f=>f.id),evidence:'authored_spatial_group_not_measured_core'},
    {id:stairId,kind:'stair-field',ownerId:coreId,hostFloorIds:floors.map(f=>f.id),lowerFFLM:lowerFFL,upperFFLM:upperFFL,midFFLM:midFFL},
    {id:railId,kind:'continuous-rail-field',ownerId:stairId,hostFloorIds:floors.map(f=>f.id)},
    {id:partitionId,kind:'partition-field',ownerId:c.upperFloorId,hostFloorId:c.upperFloorId,baseLocalY:c.floorHeight,baseFFLM:upperFFL},
    {id:doorOpeningId,kind:'opening-field',ownerId:partitionId,hostId:partitionId,purpose:'proposed-passage',bottomLocalY:c.floorHeight},
    {id:stairOpeningId,kind:'opening-field',ownerId:'slab-002',hostId:'slab-002',dependsOnId:stairId,purpose:'stair'}];
  const edges=[...nodes.filter(n=>n.ownerId).map(n=>({kind:'owned-by',from:n.id,to:n.ownerId})),
    ...floors.map(f=>({kind:'references-floor',from:coreId,to:f.id})),
    {kind:'connects',from:c.lowerFloorId,to:c.upperFloorId,via:stairId},
    {kind:'voids',from:stairOpeningId,to:'slab-002'},{kind:'voids',from:doorOpeningId,to:partitionId}];
  return {schema:'kaopu.implicit-building-relationships/0.1',host,config:c,floors,nodes,edges,
    dimensions:{width,totalLength,runLength,actualRiser,risersPerFlight,treadsPerFlight:risersPerFlight-1,lowerFFLM:lowerFFL,upperFFLM:upperFFL,midFFLM:midFFL},
    validation:{stairDomain,partitionDomain,valid:true},scope:{floorIds:floors.map(f=>f.id),coreCount:1,sourceBuildingCount:1,allHongKongBuildings:false},
    interiorEvidence:'unknown',editableProposal:true,navigationEnabled:false,completeBuilding:false,structuralCertification:false};
}

/** Explicit adapter only. The field renderer is not imported into its host graph. */
export function deriveHostGraphFromField(specOrConfig) {
  const c=specOrConfig?.config??specOrConfig;
  if(!c||typeof c!=='object')throw Error('Field specification or configuration required');
  const graph=deriveHostGraph({floorHeight:c.floorHeight,slabThickness:c.slabThickness,
    flightWidth:c.flightWidth,centerGap:c.centerGap,treadDepth:c.treadDepth,landingDepth:c.landingDepth,
    risersPerFlight:c.risersPerFlight,partitionWidth:c.wallWidth,partitionThickness:c.wallThickness,
    partitionHeight:c.wallHeight,doorWidth:c.doorWidth,doorHeight:c.doorHeight});
  const toLocal=p=>{const q=transformHostToLocal([p[0],0,-p[1]],graph.host.designFrame);return [q[0],q[2]];};
  const expectedFootprint=FOOTPRINT.map(toLocal),expectedReserve=SERVICE_RESERVE.map(toLocal);
  const same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((p,i)=>Array.isArray(p)&&p.length===2&&p.every((n,j)=>Number.isFinite(n)&&Math.abs(n-b[i][j])<=EPS));
  if(!same(c.footprint2D,expectedFootprint))throw Error('R06 source footprint field must preserve the exact observed-derived p000 boundary');
  if(!same(c.serviceVoid2D,expectedReserve))throw Error('R06 source floor field must preserve the existing authored service reserve');
  graph.fieldBindings={101:'slab-001',102:'slab-002',201:'stair-001-002:flight-001',202:'stair-001-002:flight-002',203:'stair-001-002:mid-landing',301:'floor-002:proposed-partition',401:'stair-001-002:continuous-rail'};
  graph.nodes.push({id:'stair-001-002:flight-001',kind:'flight-field',ownerId:'stair-001-002'},
    {id:'stair-001-002:flight-002',kind:'flight-field',ownerId:'stair-001-002'},
    {id:'stair-001-002:mid-landing',kind:'landing-field',ownerId:'stair-001-002',localY:c.floorHeight/2});
  for(const n of graph.nodes.slice(-3))graph.edges.push({kind:'owned-by',from:n.id,to:n.ownerId});
  for(const n of graph.nodes){
    n.effectiveEnabled=n.kind==='continuous-rail-field'?c.railsEnabled!==false
      :n.id==='floor-002:proposed-partition'||n.id==='floor-002:proposed-partition:door-opening'?c.wallEnabled!==false:true;
  }
  graph.fieldFootprint={kind:'exact_source_boundary',sourcePatchId:'p000',preservedServiceReserve:true,wholeBuildingInteriorInferred:false};
  return graph;
}
