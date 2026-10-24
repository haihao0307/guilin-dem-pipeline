import {GRID_TRACES,UNIT_TRACES,DETAIL_EVIDENCE} from './warehouse-detail-observations.mjs';
import {WAREHOUSE_CANDIDATES} from './warehouse-observed-candidates.mjs';
import {finitePrism} from './kowloon-building-mother-r01/whole-building-floor-study-r01/floor-layout.mjs';
import {ASSEMBLY_SCHEMA,packAssemblyDescriptors} from './kowloon-building-mother-r01/r07/assemblies.mjs';
/** Source face is a complete rectangular atlas domain. The missing paired UV/XYZ
 * leaves horizontal orientation unresolved. This reversible candidate maps only
 * observed panel boundaries, never cuts wall or invents window glass. */
export function attachWarehouseMainFacade(input,source,{mirror=false,enabled=true,projectionDepth=.12,detail=true}={}){
 if(input.caseId!=='warehouse')return input;const model=structuredClone(input),face=source.patches.find(p=>p.sourcePatchId==='p012');if(!face)throw Error('Observed warehouse source face missing');
 const crop=[2060,4,3072,738],rect=face.loops[0],width=Math.max(...rect.map(p=>p[0])),height=Math.max(...rect.map(p=>p[1])),root=model.graph.nodes[0].id;
 model.facadePanelProjection={enabled,mirror,status:'candidate_rectangular_atlas_mapping_not_verified_UV_XYZ',sourcePatchId:'p012',sourceGeometryUnchanged:true,wallCuts:0,glass:0,actualDepth:null,projectionDepth,detail,detailEvidence:DETAIL_EVIDENCE,records:[],unitRecords:[]};if(!enabled)return model;
 const primitives=[],graph=model.graph,host=root+':source-face:p012';if(!graph.nodes.some(n=>n.id===host)){graph.nodes.push({id:host,type:'source_surface_evidence',sourcePatchId:'p012'});graph.edges.push({from:host,to:root,type:'ownedBy'});}
 let nextId=2000;
 const frame={u:face.u,v:face.v,w:face.n,origin:face.origin};
 const uv=([x,y])=>[(mirror?1-x/1012:x/1012)*width,(734-y)/734*height];
 const boxLoop=b=>{const a=uv([b[0],b[1]]),z=uv([b[2],b[3]]);return [[a[0],a[1]],[z[0],a[1]],[z[0],z[1]],[a[0],z[1]]];};
 function part(id,loops,depth,kind,owner){const p=finitePrism(id,loops,depth,frame);p.objectId=nextId++;p.semanticClass=kind;p.geometryEvidence='visible_pixel_trace_with_inferred_mapping_and_depth';primitives.push(p);graph.nodes.push({id,type:'unclassified_facade_panel',sourcePatchId:'p012',evidence:'官方图集可见轮廓/分格；投影方向、厚度与设备具体型号未核准；裁片外不补形体。'});graph.edges.push({from:id,to:owner,type:'ownedBy'});return p;}
 for(const [i,c] of WAREHOUSE_CANDIDATES.entries()){
  const t=GRID_TRACES[i],outer=boxLoop(t.bbox),u0=Math.min(...outer.map(q=>q[0])),u1=Math.max(...outer.map(q=>q[0])),v0=Math.min(...outer.map(q=>q[1])),v1=Math.max(...outer.map(q=>q[1]));
  const id=c.id+':mapped-boundary';let p;
  if(!detail)p=part(id,[outer],[.006,.031],'UNKNOWN',host);
  else{
   // Recessed dark inspectable backing is not glass or a through-wall hole.
   part(id+':backing',[outer],[.006,.025],'equipment_recess',id);
   const xs=[t.bbox[0],...t.vertical,t.bbox[2]],ys=[t.bbox[1],...t.horizontal,t.bbox[3]],holes=[];
   for(let x=0;x<xs.length-1;x++)for(let y=0;y<ys.length-1;y++)holes.push(boxLoop([xs[x]+1.2,ys[y]+1.2,xs[x+1]-1.2,ys[y+1]-1.2]));
   p=part(id,[outer,...holes],[.025,projectionDepth],'grille',host);
  }
  graph.edges.push({from:id,to:c.id,type:'observedFrom'});
  model.facadePanelProjection.records.push({...c,nodeId:id,u0,u1,v0,v1,worldBounds:p.bounds,mappingMirror:mirror,eligibleForWallCut:false,actualDimensionsM:null,visibleGridCells:detail?16:0});
 }
 if(detail)for(const t of UNIT_TRACES){
  const id='warehouse-p012:'+t.id,body=part(id,[boxLoop(t.bbox)],[.008,.28],'equipment',host);
  // Fan front is clipped to the observed image boundary. No invented lower edge.
  const [cx,cy]=t.fanCenter,r=t.fanRadiusPixels;let disk=[];
  for(let i=0;i<48;i++){const a=i*Math.PI*2/48;disk.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  const clipped=[];for(let i=0;i<disk.length;i++){const a=disk[i],b=disk[(i+1)%disk.length],ina=a[1]<=734,inb=b[1]<=734;if(ina)clipped.push(a);if(ina!==inb){const f=(734-a[1])/(b[1]-a[1]);clipped.push([a[0]+f*(b[0]-a[0]),734]);}}
  const unique=clipped.filter((q,i)=>i===0||Math.hypot(q[0]-clipped[i-1][0],q[1]-clipped[i-1][1])>1e-7);if(Math.hypot(unique[0][0]-unique.at(-1)[0],unique[0][1]-unique.at(-1)[1])<1e-7)unique.pop();
  part(id+':fan-visible',[unique.map(uv)],[.281,.285],'equipment_recess',id);
  model.facadePanelProjection.unitRecords.push({...t,nodeId:id,worldBounds:body.bounds,actualDepth:null,designDepth:.28,geometryScope:'visible_cropped_front_only'});
 }
 const bounds={min:[0,1,2].map(k=>Math.min(...primitives.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...primitives.map(p=>p.bounds.max[k])))},id='warehouse-observed-facade-panels',a={id,schema:ASSEMBLY_SCHEMA,primitives,bounds,counts:{primitives:primitives.length,modelTriangles:0}};a.spec={schema:a.schema,primitives,bounds};packAssemblyDescriptors(a);model.archetypes.push(a);model.instances.push({id:id+':instance',archetypeId:id,translation:[0,0,0],floorId:null,objectIdOffset:880000,bounds,kind:'facade-observation'});return model;
}
