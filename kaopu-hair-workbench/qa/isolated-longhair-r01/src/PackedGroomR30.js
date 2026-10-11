import * as T from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {strandClearanceR30} from './StrandClearanceR30.js';
import {FullerScalpBinding} from './RefinedHairLayer.js';
import {scalpMargin} from './RegionFields.js';
class RootSampler extends FullerScalpBinding{setStyle(){}}
/** Direct packed copy of the frozen 79efd2 static centreline authoring algorithm.
 * Same roots, seed, 64 segments, surface release and body-clearance parameters.
 * Builds the final FP32 texels directly: no expanded two-sided vertex arrays,
 * tangents, per-strand indices, legacy mesh or GPU upload is constructed here.
 */
export function buildPackedGroomR30(a,guides,{count=1800,radius=.000045,textureWidth=2048,prefixSegmentRepair=true,matchingRootSupport=false}={}){
 if(!Number.isInteger(count)||count<1||count>16777216)throw Error('Invalid packed strand count');
 if(!Number.isFinite(radius)||radius<0)throw Error('Invalid physical radius');
 if(!Number.isInteger(textureWidth)||textureWidth<1)throw Error('Invalid texture width');
 if(typeof prefixSegmentRepair!=='boolean')throw Error('prefixSegmentRepair must be boolean');
 const started=performance.now(),v=a.motion().viewer,m=a.motion().controller.model,g=m.gnm,G=guides.report(),gp=guides.mesh.geometry.attributes.position.array,segments=64,surfaceSegments=20,per=65,pt=(ar,i)=>new T.Vector3().fromArray(ar,i*3),sampleGuide=(i,j)=>new T.Vector3().fromArray(gp,(i*65+j)*6),roots=new RootSampler(g,{count,segments:0,seed:4711}),inv=new Int32Array(g.numVertices).fill(-1);m.canonical.gnmRecipes.forEach(([x,y,t],i)=>{if(x===y&&t===0)inv[x]=m.bodyCount+i;});const p=v.geometry.attributes.position.array,n=v.geometry.attributes.normal.array;
 const oriented=new Set();for(let i=0;i<m.faces.length;i+=3){const[x,y,z]=m.faces.slice(i,i+3);oriented.add(`${x},${y},${z}`);oriented.add(`${y},${z},${x}`);oriented.add(`${z},${x},${y}`);}let verified=0;const triangles=[],grid=new Map(),cell=.012;
 const rootFaceSet=matchingRootSupport?new Set(roots.selectFaces().items.map(r=>r.t)):null;for(let t=0;t<g.triangles.length/3;t++){const ids=Array.from(g.triangles.subarray(t*3,t*3+3));if(ids.some(id=>g.componentId[id]!==0)||(matchingRootSupport?!rootFaceSet.has(t):ids.some(id=>scalpMargin(Array.from(g.template.subarray(id*3,id*3+3)))<0)))continue;if(ids.some(id=>inv[id]<0)||!oriented.has(ids.map(id=>inv[id]).join(',')))throw Error('Missing oriented scalp triangle');verified++;const vs=ids.map(id=>pt(p,inv[id])),tri=new T.Triangle(...vs),id=triangles.length;triangles.push({tri,ids});const lo=[0,1,2].map(k=>Math.floor(Math.min(...vs.map(v=>v.getComponent(k)))/cell)),hi=[0,1,2].map(k=>Math.floor(Math.max(...vs.map(v=>v.getComponent(k)))/cell));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const key=[x,y,z].join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);}}
 function mappedRoot(i){const ids=Array.from(g.triangles.subarray(roots.rootTriangles[i]*3,roots.rootTriangles[i]*3+3)),b=roots.rootBarycentrics.subarray(i*3,i*3+3),pos=new T.Vector3(),normal=new T.Vector3();if(ids.some(id=>inv[id]<0)||!oriented.has(ids.map(id=>inv[id]).join(',')))throw Error('Unmapped follicle');ids.forEach((id,k)=>{pos.addScaledVector(pt(p,inv[id]),b[k]);normal.addScaledVector(pt(n,inv[id]),b[k]);});return{pos,normal:normal.normalize()};}
 let scalpFallbackCount=0,scalpFallbackMaxDistanceM=0,minimumProjectedMarginM=Infinity;function surface(target){const c=target.toArray().map(x=>Math.floor(x/cell)),seen=new Set(),q=new T.Vector3();let best=null,d=Infinity,point=new T.Vector3();for(let x=c[0]-1;x<=c[0]+1;x++)for(let y=c[1]-1;y<=c[1]+1;y++)for(let z=c[2]-1;z<=c[2]+1;z++)for(const id of grid.get([x,y,z].join(','))||[]){if(seen.has(id))continue;seen.add(id);const r=triangles[id];r.tri.closestPointToPoint(target,q);const e=q.distanceToSquared(target);if(e<d){d=e;best=r;point.copy(q);}}if(!best){scalpFallbackCount++;for(const r of triangles){r.tri.closestPointToPoint(target,q);const e=q.distanceToSquared(target);if(e<d){d=e;best=r;point.copy(q);}}scalpFallbackMaxDistanceM=Math.max(scalpFallbackMaxDistanceM,Math.sqrt(d));if(!best||d>.06*.06)throw Error('Scalp interpolation beyond bounded global support '+Math.sqrt(d));}const b=best.tri.getBarycoord(point,new T.Vector3()),normal=new T.Vector3();best.ids.forEach((id,k)=>normal.addScaledVector(pt(n,inv[id]),b.getComponent(k)));const neutralPoint=new T.Vector3();best.ids.forEach((id,k)=>neutralPoint.addScaledVector(pt(g.template,id),b.getComponent(k)));minimumProjectedMarginM=Math.min(minimumProjectedMarginM,scalpMargin(neutralPoint.toArray()));return{pos:point,normal:normal.normalize()};}
 const clearanceSolver=strandClearanceR30(v.geometry);
 const maxTextureSize=v.renderer.capabilities.maxTextureSize;
 function allocate(entries){const width=Math.min(textureWidth,maxTextureSize,entries),height=Math.ceil(entries/width);if(!Number.isFinite(width)||width<1||height>maxTextureSize)throw Error('Packed texture exceeds renderer limits');return{width,height,data:new Float32Array(width*height*4)};}
 const pointTexture=allocate(count*per),normalTexture=allocate(count*(surfaceSegments+1)),pointData=pointTexture.data,normalData=normalTexture.data,records=[];
 const packedPoint=i=>new T.Vector3().fromArray(pointData,i*4);
 let rootLiftMax=0,maxRadius=0,maxFreeOffset=0;const distribution={};
 for(let i=0;i<count;i++){const r=mappedRoot(i),neutral=Array.from(roots.templateRoots.subarray(i*3,i*3+3)),rand=roots.random[i*4+2];let best=0,start=0,dist=Infinity;const candidates=[];for(let k=0;k<G.count;k++){let gd=Infinity,gj=0;if(G.records[k].region==='temple-wisp')continue;for(let j=0;j<=20;j++){let e=sampleGuide(k,j).distanceToSquared(r.pos);if(Math.sign(G.records[k].root[0])!==Math.sign(neutral[0])&&Math.abs(neutral[0])>.025)e+=.03;if(e<gd){gd=e;gj=j;}if(e<dist){dist=e;best=k;start=j;}}candidates.push({guide:k,start:gj,distance:gd});}const front=G.records[best].tail.at(-1)[2]>=0,neighbors=candidates.filter(c=>(G.records[c.guide].tail.at(-1)[2]>=0)===front).sort((a,b)=>a.distance-b.distance).slice(0,3);let total=0;for(const c of neighbors){c.weight=Math.exp(-c.distance/(.025*.025));total+=c.weight;}for(const c of neighbors)c.weight/=total;const blend=(u,tail=false)=>{const p=new T.Vector3();for(const c of neighbors){const t=tail?u:c.start+(20-c.start)*u,lo=Math.floor(t),hi=Math.min(64,lo+1);p.addScaledVector(sampleGuide(c.guide,lo).lerp(sampleGuide(c.guide,hi),t-lo),c.weight);}return p;};const base=blend(0),rootOffset=r.pos.clone().sub(base),angle=rand*Math.PI*2,freeOffset=new T.Vector3(Math.cos(angle),0,Math.sin(angle)).multiplyScalar(.00065*(.3+.7*roots.random[i*4+1]));maxFreeOffset=Math.max(maxFreeOffset,freeOffset.length());distribution[G.records[best].region]=(distribution[G.records[best].region]||0)+1;const lateralAxis=new T.Vector3(...G.headFrame.currentAxes[0]),lateralOffset=lateralAxis.multiplyScalar(Math.max(-.025,Math.min(.025,rootOffset.dot(lateralAxis)*.7)));let releaseOffset=new T.Vector3(),lastNormal=r.normal;
  for(let j=0;j<per;j++){let pos,normal;if(j===0){pos=r.pos.clone().addScaledVector(r.normal,.00002);normal=r.normal;rootLiftMax=Math.max(rootLiftMax,pos.distanceTo(r.pos));}else if(j<=20){const u=j/20,target=blend(u).addScaledVector(rootOffset,(1-u)**2).addScaledVector(lateralOffset,u*u).addScaledVector(freeOffset,u*u),sp=surface(target),lift=.00002+.004*(1-Math.exp(-u*15));pos=sp.pos.addScaledVector(sp.normal,lift);normal=sp.normal;if(j===20)releaseOffset.copy(pos).sub(blend(20,true));}else{const t=(j-20)/44;pos=clearanceSolver.project(blend(j,true).addScaledVector(releaseOffset,Math.exp(-t*4)).addScaledVector(lateralOffset,1-Math.exp(-t*4)).addScaledVector(freeOffset,1-Math.exp(-t*4)),.0021+.0014*Math.max(0,Math.min(1,(j-46)/8)));normal=lastNormal;}lastNormal=normal;const q=(i*per+j)*4;pos.toArray(pointData,q);pointData[q+3]=radius*(.75+.45*rand)*(1-.92*(j/segments)**7);maxRadius=Math.max(maxRadius,pointData[q+3]);if(j<=surfaceSegments){const n=(i*(surfaceSegments+1)+j)*4;normal.toArray(normalData,n);normalData[n+3]=rand;}}
  records.push({index:i,region:G.records[best].region,guide:best,neighborGuides:neighbors.map(c=>[c.guide,c.weight])});}
 const prefixRepair=prefixSegmentRepair
  ?clearanceSolver.repairPrefixSegments({pointData,count,segments,surfaceSegments})
  :{enabled:false,method:'disabled explicitly; no prefix repair performed'};
 // Read-only direction and spread diagnostics. No root or guide edits.
 const rearAxis=new T.Vector3(...G.headFrame.currentAxes[2]).negate().normalize();
 const lateralAxis=new T.Vector3(...G.headFrame.currentAxes[0]).normalize();
 const makeRegion=()=>({count:0,validDirections:0,degenerateDirections:0,negative:0,nearzero:0,sum:0,min:Infinity,max:-Infinity,rootMin:Infinity,rootMax:-Infinity,releaseMin:Infinity,releaseMax:-Infinity,rootSum:0,rootSquareSum:0,releaseSum:0,releaseSquareSum:0});
 const rootRegions={forehead:makeRegion(),side:makeRegion(),back:makeRegion()},allRoots=makeRegion();
 for(let i=0;i<count;i++){
  const neutral=roots.templateRoots.subarray(i*3,i*3+3);
  const region=neutral[2]>.025&&neutral[1]>.33?'forehead':Math.abs(neutral[0])>.045?'side':'back';
  const root=packedPoint(i*per),next=packedPoint(i*per+1),release=packedPoint(i*per+surfaceSegments);
  const rootNormal=new T.Vector3().fromArray(normalData,i*(surfaceSegments+1)*4).normalize();
  const tangent=next.sub(root),rearTangent=rearAxis.clone().addScaledVector(rootNormal,-rearAxis.dot(rootNormal));
  const valid=tangent.lengthSq()>1e-18&&rearTangent.lengthSq()>1e-18;
  const dot=valid?Math.max(-1,Math.min(1,tangent.normalize().dot(rearTangent.normalize()))):null;
  const rootLateral=root.dot(lateralAxis),releaseLateral=release.dot(lateralAxis);
  for(const row of [rootRegions[region],allRoots]){
   row.count++;row.rootMin=Math.min(row.rootMin,rootLateral);row.rootMax=Math.max(row.rootMax,rootLateral);
   row.releaseMin=Math.min(row.releaseMin,releaseLateral);row.releaseMax=Math.max(row.releaseMax,releaseLateral);
   row.rootSum+=rootLateral;row.rootSquareSum+=rootLateral*rootLateral;row.releaseSum+=releaseLateral;row.releaseSquareSum+=releaseLateral*releaseLateral;
   if(valid){row.validDirections++;row.sum+=dot;row.min=Math.min(row.min,dot);row.max=Math.max(row.max,dot);if(dot<0)row.negative++;if(Math.abs(dot)<.15)row.nearzero++;}
   else row.degenerateDirections++;
  }
 }
 function summarizeRegion(row){
  const rootWidth=row.count?row.rootMax-row.rootMin:null,releaseWidth=row.count?row.releaseMax-row.releaseMin:null;
  return{count:row.count,validDirections:row.validDirections,degenerateDirections:row.degenerateDirections,
   negative:row.negative,nearzero:row.nearzero,mean:row.validDirections?row.sum/row.validDirections:null,min:row.validDirections?row.min:null,max:row.validDirections?row.max:null,
   rootLateralWidthM:rootWidth,prefixEndLateralWidthM:releaseWidth,widthRatio:rootWidth>0?releaseWidth/rootWidth:null,
   rootLateralStdDevM:row.count?Math.sqrt(Math.max(0,row.rootSquareSum/row.count-(row.rootSum/row.count)**2)):null,
   prefixEndLateralStdDevM:row.count?Math.sqrt(Math.max(0,row.releaseSquareSum/row.count-(row.releaseSum/row.count)**2)):null};
 }
 const rootDirectionDiagnostics={
  method:'unit j0-to-j1 direction dotted with unit projected head-rear axis in the root-normal plane',
  classification:'neutral-space forehead z>0.025 and y>0.33; otherwise side abs(x)>0.045; back is the remaining roots',
  negativeThreshold:0,nearzeroAbsoluteThreshold:.15,countsMayOverlap:true,
  regions:Object.fromEntries(Object.entries(rootRegions).map(([key,row])=>[key,summarizeRegion(row)])),all:summarizeRegion(allRoots),
  spreadMethod:'min/max width and standard deviation along current head lateral axis, point 0 versus surface-release point 20',
  interpretation:'pure direction/spread diagnostics, not anatomical truth or a hairstyle-quality verdict; no automatic grooming change',
 };
 let maxFreeTurnDeg=0,maxFreeTurnLocation=null;for(let i=0;i<count;i++)for(let j=22;j<64;j++){const a=packedPoint(i*per+j).sub(packedPoint(i*per+j-1)),b=packedPoint(i*per+j+1).sub(packedPoint(i*per+j)),angle=a.angleTo(b)*180/Math.PI;if(angle>maxFreeTurnDeg){maxFreeTurnDeg=angle;maxFreeTurnLocation={strand:i,vertex:j};}}
 const bounds=new T.Box3();for(let i=0;i<count*per;i++)bounds.expandByPoint(packedPoint(i));
 const center=bounds.getCenter(new T.Vector3());let boundRadiusSquared=0;for(let i=0;i<count*per;i++)boundRadiusSquared=Math.max(boundRadiusSquared,center.distanceToSquared(packedPoint(i)));
 const boundingSphere=new T.Sphere(center,Math.sqrt(boundRadiusSquared));
 const textureBytes=pointData.byteLength+normalData.byteLength,texturePayloadBytes=count*(per+surfaceSegments+1)*16;
 const constructionMs=performance.now()-started,clearanceReport=clearanceSolver.report();
 const reportData={scalpProjection:{matchingRootSupport,minimumProjectedMarginM,fallbackCount:scalpFallbackCount,fallbackMaxDistanceM:scalpFallbackMaxDistanceM,method:"local12mm-grid then actual supported triangles when empty; 60mm max bound"},
  kind:'R30-direct-packed-fibre-data',count,segments,surfaceSegments,prefixRepair,rootDirectionDiagnostics,
  finite:pointData.every(Number.isFinite)&&normalData.every(Number.isFinite),missingSupports:0,
  orientedFacesVerified:verified,rootLiftMax,
  rootSampler:'existing FullerScalpBinding surface follicular-unit roots',
  interpolation:'three same-route guides plus bounded root lateral residual; continuous surface release offset',
  distribution,records,headFrame:G.headFrame,maximumPhysicalRadiusM:maxRadius,
  maximumFreeOffsetM:maxFreeOffset,maxFreeTurnDeg,maxFreeTurnLocation,
  tailClearanceM:.0035,clearanceSolver:clearanceReport,physics:false,
  sourceAlgorithm:'frozen 79efd2 authoring and free clearance; direct storage with bounded missing-support fallback and optional detected-prefix-intersection repair',
  geometryBytes:textureBytes,constructionMs,
  directPacked:true,expandedGeometryAllocated:false,legacyGeometryBytesAllocated:0,
  dataBytes:{textureBytes,texturePayloadBytes,texturePaddingBytes:textureBytes-texturePayloadBytes,
    pointTextureBytes:pointData.byteLength,normalTextureBytes:normalData.byteLength,
    cpuOutputTypedArrayBytes:textureBytes,gpuBytesAllocatedDuringBuild:0,
    rootSamplerTypedArrayBytes:Object.values(roots).reduce((sum,value)=>sum+(ArrayBuffer.isView(value)?value.byteLength:0),0),
    excludes:'source body/guides, authoring grids, triangle objects, root sampler maps, temporary vectors, JS records, allocator and driver overhead; no total-heap or peak-RSS claim'},
  rootRadiusInterpretation:'root follicular emergence may intersect skin locally; full free section requires positive radius clearance',
 };
 return{
  kind:'R30-packed-fibre-data',pointData,normalData,
  pointTextureSize:[pointTexture.width,pointTexture.height],normalTextureSize:[normalTexture.width,normalTexture.height],
  boundingSphere,boundingBox:bounds,matrix:v.mesh.matrix.clone(),
  fiberOptions:{color:'#080708',roughness:.43,specular:.075,coverageResolve:'blend'},
  report:()=>reportData,
 };
}
