import {WAREHOUSE_CANDIDATES} from './warehouse-observed-candidates.mjs';
import {finitePrism} from './kowloon-building-mother-r01/whole-building-floor-study-r01/floor-layout.mjs';
import {ASSEMBLY_SCHEMA,packAssemblyDescriptors} from './kowloon-building-mother-r01/r07/assemblies.mjs';
/** Source face is a complete rectangular atlas domain. The missing paired UV/XYZ
 * leaves horizontal orientation unresolved. This reversible candidate maps only
 * observed panel boundaries, never cuts wall or invents window glass. */
export function attachWarehouseMainFacade(input,source,{mirror=false,enabled=true,projectionDepth=.025}={}){
 if(input.caseId!=='warehouse')return input;const model=structuredClone(input),face=source.patches.find(p=>p.sourcePatchId==='p012');if(!face)throw Error('Observed warehouse source face missing');
 const crop=[2060,4,3072,738],rect=face.loops[0],width=Math.max(...rect.map(p=>p[0])),height=Math.max(...rect.map(p=>p[1])),root=model.graph.nodes[0].id;
 model.facadePanelProjection={enabled,mirror,status:'candidate_rectangular_atlas_mapping_not_verified_UV_XYZ',sourcePatchId:'p012',sourceGeometryUnchanged:true,wallCuts:0,glass:0,actualDepth:null,projectionDepth,records:[]};if(!enabled)return model;
 const primitives=[],graph=model.graph,host=root+':source-face:p012';if(!graph.nodes.some(n=>n.id===host)){graph.nodes.push({id:host,type:'source_surface_evidence',sourcePatchId:'p012'});graph.edges.push({from:host,to:root,type:'ownedBy'});}
 for(const [i,c] of WAREHOUSE_CANDIDATES.entries()){
  let [x0,y0,x1,y1]=c.atlasBBoxXYXY;let u0=(x0-crop[0])/(crop[2]-crop[0])*width,u1=(x1-crop[0])/(crop[2]-crop[0])*width;if(mirror)[u0,u1]=[width-u1,width-u0];const v0=(crop[3]-y1)/(crop[3]-crop[1])*height,v1=(crop[3]-y0)/(crop[3]-crop[1])*height;
  const id=c.id+':mapped-boundary',p=finitePrism(id,[[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]],[.006,.006+projectionDepth],{u:face.u,v:face.v,w:face.n,origin:face.origin});p.objectId=2000+i;p.semanticClass='UNKNOWN';p.geometryEvidence='observed_image_boundary_with_candidate_affine_mapping_and_design_depth';primitives.push(p);
  graph.nodes.push({id,type:'unclassified_facade_panel',sourcePatchId:'p012',evidence:'观察到网格状矩形；面板/通风口/窗未确认。矩形映射方向与厚度为待核候选。'});graph.edges.push({from:id,to:host,type:'ownedBy'},{from:id,to:c.id,type:'observedFrom'});
  model.facadePanelProjection.records.push({...c,nodeId:id,u0,u1,v0,v1,worldBounds:p.bounds,mappingMirror:mirror,eligibleForWallCut:false,actualDimensionsM:null});
 }
 const bounds={min:[0,1,2].map(k=>Math.min(...primitives.map(p=>p.bounds.min[k]))),max:[0,1,2].map(k=>Math.max(...primitives.map(p=>p.bounds.max[k])))},id='warehouse-observed-facade-panels',a={id,schema:ASSEMBLY_SCHEMA,primitives,bounds,counts:{primitives:primitives.length,modelTriangles:0}};a.spec={schema:a.schema,primitives,bounds};packAssemblyDescriptors(a);model.archetypes.push(a);model.instances.push({id:id+':instance',archetypeId:id,translation:[0,0,0],floorId:null,objectIdOffset:880000,bounds,kind:'facade-observation'});return model;
}
