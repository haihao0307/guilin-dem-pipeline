/** Original measured-shell assembly experiment. No FreeCAD/IfcOpenShell code is copied. */
import {reconstructBuffers, validateScore} from '../../hk-three-buildings-r01/geometry/reconstruct.mjs';
export const SCHEMA='kaopu.measured-shell-assembly/0.1';
const clone=x=>structuredClone(x);
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const finite=(x,label)=>{if(!Number.isFinite(x))throw Error(`Non-finite ${label}`);return x;};
const patchRole=kind=>kind==='roofPlane'?'roof':kind==='undersidePlane'?'underside':'wall';
export function towerRule(score){
 const ops=score.reconstruction.operations, roofs=ops.filter(o=>o.kind==='roofPlane'),walls=ops.filter(o=>o.kind==='wallStrip');
 if(roofs.length!==1||walls.length!==ops.length-1||!walls.length)return null;
 const r=roofs[0],h=r.heightPlane[2],bottom=walls[0].bottom;
 if(Math.abs(r.heightPlane[0])+Math.abs(r.heightPlane[1])>1e-10||walls.some(w=>Math.abs(w.top-h)>1e-7||Math.abs(w.bottom-bottom)>1e-7))return null;
 return {type:'flat-roof-common-wall-top',roof:r.id,walls:walls.map(w=>w.id),baselineTop:h,bottom,evidence:'equal measured top heights and horizontal roof plane; not a structural or historical assertion'};
}
export function createAssembly(score){
 validateScore(score);const source=freeze(clone(score));const rule=towerRule(source);
 return {schema:SCHEMA,objectId:score.objectId,source,rule,top:rule?.baselineTop??null,translation:[0,0,0],shell:{visible:true,enabled:true},patches:source.reconstruction.operations.map(o=>({id:o.id,assemblyParentId:`${score.objectId}:shell`,role:patchRole(o.kind),kind:o.kind,visible:true,enabled:true,roleEvidence:'inferred_from_surface_orientation',geometryEvidence:'observed_derived',hostId:null,openingId:null})),unsupported:['floors','rooms','openings','structural_support','clearance','historical_old_new_split']};
}
export function setState(a,id,changes){
 const target=id==='shell'?a.shell:a.patches.find(p=>p.id===id);if(!target)throw Error(`Unknown node ${id}`);
 for(const [key,value] of Object.entries(changes)){if(!['visible','enabled'].includes(key)||typeof value!=='boolean')throw Error('Only boolean visibility or assembly-enabled may be changed');target[key]=value;}
 return a;
}
export function setTop(a,top){
 if(!a.rule)throw Error('No measured common-top rule for this building');finite(top,'top');
 if(top<a.rule.bottom+1||top>150)throw Error('Trial top height must be between base + 1 m and 150 m');a.top=top;return a;
}
export function setTranslation(a,v){if(!Array.isArray(v)||v.length!==3)throw Error('Translation needs three coordinates');v.forEach(x=>finite(x,'translation'));if(v.some(x=>Math.abs(x)>1000))throw Error('Trial translation budget');a.translation=v.slice();return a;}
export function evaluateScore(a,{assemblyOnly=false}={}){
 const score=clone(a.source);
 if(a.rule&&a.top!==a.rule.baselineTop){for(const op of score.reconstruction.operations){if(op.id===a.rule.roof)op.heightPlane[2]=a.top;else if(a.rule.walls.includes(op.id))op.top=a.top;}}
 if(assemblyOnly)score.reconstruction.operations=score.reconstruction.operations.filter(op=>a.shell.enabled&&a.patches.find(p=>p.id===op.id).enabled);
 return score;
}
export function evaluate(a,THREE){
 const data=reconstructBuffers(evaluateScore(a),THREE);
 return data.patches.map((p,i)=>{const state=a.patches.find(n=>n.id===p.id);return {...state,start:p.start,count:p.count,holes:p.holes,materialIndex:data.groups[i].materialIndex,positions:data.positions.slice(p.start*3,(p.start+p.count)*3),normals:data.normals.slice(p.start*3,(p.start+p.count)*3),effectiveEnabled:a.shell.enabled&&state.enabled,effectiveVisible:a.shell.visible&&state.visible&&a.shell.enabled&&state.enabled,worldTranslation:a.translation.slice()};});
}
export function exportAssembly(a){
 const score=evaluateScore(a,{assemblyOnly:true}),included=score.reconstruction.operations.map(o=>o.id);
 return {schema:SCHEMA,objectId:a.objectId,sourceIdentity:a.source.georeference,placement:{displayTranslationMetres:a.translation.slice(),changesGeographicSourceAnchor:false},operations:score.reconstruction.operations,includedPatchIds:included,excludedPatchIds:a.patches.filter(p=>!included.includes(p.id)).map(p=>p.id),authoredDeformation:a.rule&&a.top!==a.rule.baselineTop?{parameter:'commonRoofTopM',value:a.top,original:a.rule.baselineTop}:null,warning:included.length!==a.patches.length?'INCOMPLETE MEASURED SHELL. No replacement surfaces, collision, waterproofness or structural validity are inferred.':null,unknown:a.unsupported.slice()};
}
export function resetAssembly(a){const fresh=createAssembly(a.source);Object.assign(a,fresh);return a;}
export function coincidentEdges(patches,tolerance=1e-5){
 // Only whole, matching triangulated boundary segments. This intentionally does
 // not assert complete contact at T-junctions or physical structural support.
 const key=p=>p.map(x=>Math.round(x/tolerance)).join(',');const byEdge=new Map();
 for(const p of patches){const local=new Map();for(let i=0;i<p.positions.length;i+=9){const q=[0,3,6].map(j=>Array.from(p.positions.slice(i+j,i+j+3)));for(let j=0;j<3;j++){const ends=[q[j],q[(j+1)%3]].sort((a,b)=>key(a).localeCompare(key(b)));const k=ends.map(key).join('|');const cur=local.get(k);local.set(k,{ends,count:(cur?.count??0)+1});}}
  for(const [k,e] of local)if(e.count===1){if(!byEdge.has(k))byEdge.set(k,[]);byEdge.get(k).push({patch:p.id,ends:e.ends});}}
 const result=[];for(const entries of byEdge.values())if(entries.length>1){for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(entries[i].patch!==entries[j].patch){const [a,b]=entries[i].ends;result.push({a:entries[i].patch,b:entries[j].patch,ends:[a,b],lengthM:Math.hypot(...a.map((v,k)=>v-b[k])),evidence:'derived_coincident_boundary_segment',structuralSupport:false});}}
 return result;
}
export function assemblyStats(a,THREE){const patches=evaluate(a,THREE),exp=exportAssembly(a);return {id:a.objectId,patchCount:patches.length,triangles:patches.reduce((n,p)=>n+p.count/3,0),visiblePatches:patches.filter(p=>p.effectiveVisible).length,assemblyPatches:exp.includedPatchIds.length,assemblyTriangles:patches.filter(p=>p.effectiveEnabled).reduce((n,p)=>n+p.count/3,0),coincidentEdgeSegments:coincidentEdges(patches).length,edited:!!exp.authoredDeformation,incomplete:!!exp.warning,top:a.top,sourceMutated:JSON.stringify(a.source)!==JSON.stringify(evaluateScore(createAssembly(a.source)))};}
