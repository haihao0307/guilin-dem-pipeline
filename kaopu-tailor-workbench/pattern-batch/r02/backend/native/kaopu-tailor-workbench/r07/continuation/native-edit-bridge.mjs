/** Bridge the inherited explicit editing core back to native analytic paper.
 * No human change, material deletion repair, stale curve cache or inherited pass flag.
 */
import {validateEditablePattern,samplePatternEdge,stablePatternJSON} from '../../learning/patterngsl-r01/pattern-edit-kernel.mjs';
const clone=x=>structuredClone(x),distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const requireValue=(ok,message)=>{if(!ok)throw Error('EDIT_BRIDGE: '+message);};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const sha=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stablePatternJSON(x)))),v=>v.toString(16).padStart(2,'0')).join('');
function pointSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],q=dx*dx+dy*dy,t=q?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/q)):0;return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
function sampled(panel,edge){
 const out=[],at=t=>samplePatternEdge(panel,edge,t);
 function split(t0,t1,a,b,depth){
  const deviations=[.25,.5,.75].map(f=>pointSegment(at(t0+(t1-t0)*f),a,b));
  if((Math.max(...deviations)>.1||distance(a,b)>8)&&depth<18){const mid=(t0+t1)/2,m=at(mid);split(t0,mid,a,m,depth+1);split(mid,t1,m,b,depth+1);}else out.push(a);
  requireValue(out.length<=8192,'edge sampling budget exceeded; no omitted geometry');
 }
 split(0,1,at(0),at(1),0);out.push(at(1));return out;
}
function bezierDerivative(panel,e,t){
 let q=[panel.verticesMm[e.endpoints[0]],...e.controlPointsMm,panel.verticesMm[e.endpoints[1]]],degree=q.length-1;
 q=q.slice(1).map((v,i)=>v.map((x,k)=>degree*(x-q[i][k])));
 for(let n=q.length-1;n>0;n--)for(let i=0;i<n;i++)for(let k=0;k<2;k++)q[i][k]=q[i][k]*(1-t)+q[i+1][k]*t;
 return Math.hypot(...q[0]);
}
function curveLength(panel,e){
 if(e.kind==='line')return distance(...e.endpoints.map(i=>panel.verticesMm[i]));
 if(e.kind==='circle')return e.arc.radiusMm*Math.abs(e.arc.sweepDegrees)*Math.PI/180;
 const f=t=>bezierDerivative(panel,e,t),simpson=(a,b,x,y,z)=>(b-a)*(x+4*y+z)/6;
 const recurse=(a,b,fa,fm,fb,whole,eps,depth)=>{const m=(a+b)/2,fl=f((a+m)/2),fr=f((m+b)/2),left=simpson(a,m,fa,fl,fm),right=simpson(m,b,fm,fr,fb),delta=left+right-whole;if(depth===0||Math.abs(delta)<=15*eps)return left+right+delta/15;return recurse(a,m,fa,fl,fm,left,eps/2,depth-1)+recurse(m,b,fm,fr,fb,right,eps/2,depth-1);};
 const a=f(0),m=f(.5),b=f(1);return recurse(0,1,a,m,b,simpson(0,1,a,m,b),1e-7,20);
}
function intersectionPairs(poly){
 const n=poly.length,segments=poly.map((a,i)=>{const b=poly[(i+1)%n];return{a,b,i,minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0]),minY:Math.min(a[1],b[1]),maxY:Math.max(a[1],b[1])};}).sort((a,b)=>a.minX-b.minX),found=[];let active=[];
 for(const s of segments){active=active.filter(t=>t.maxX>=s.minX);for(const t of active){if(Math.abs(s.i-t.i)===1||Math.abs(s.i-t.i)===n-1||s.maxY<t.minY||s.minY>t.maxY)continue;const a=cross(s.a,s.b,t.a),b=cross(s.a,s.b,t.b),c=cross(t.a,t.b,s.a),d=cross(t.a,t.b,s.b);if(a*b< -1e-12&&c*d< -1e-12)found.push([t.i,s.i]);}active.push(s);}
 return found;
}
function curvature(panel,e,original){
 if(e.kind==='line')return null;
 if(e.kind==='circle')return{type:'circle',params:[e.arc.radiusMm,...original.curvature.params.slice(1)]};
 const [a,b]=e.endpoints.map(i=>panel.verticesMm[i]),dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy;requireValue(n>1e-14,'collapsed Bezier chord');
 return{type:e.kind,params:e.controlPointsMm.map(c=>[((c[0]-a[0])*dx+(c[1]-a[1])*dy)/n,(dx*(c[1]-a[1])-dy*(c[0]-a[0]))/n])};
}
export async function rebuildEditedAnalytic(base,document,{operations=[]}={}){
 requireValue(base?.schema==='kaopu-analytic-sewing-pattern@1'&&base.units==='mm','native source in millimetres required');validateEditablePattern(document);
 requireValue(document.source.recipeHash===base.recipeHash&&document.source.geometryHash===base.geometryHash,'edit refers to a different source recipe');
 const originalById=new Map(base.panels.map(p=>[p.id,p])),nativeId=new Map(),errors=[],warnings=[],out=clone(base),lookup=new Map();
 out.panels=document.panels.map(p=>{
  const original=originalById.get(p.sourcePanelId);requireValue(original,'unknown source panel identity');nativeId.set(p.id,p.sourcePanelId);
  const result=clone(original);result.verticesMm=clone(p.verticesMm);result.placement=clone(p.placement);result.boundary=[...p.boundary];
  result.edges=p.edges.map(e=>{const old=original.edges.find(x=>x.index===e.id);requireValue(old,'edge identity cannot be silently replaced');const length=curveLength(p,e),pts=sampled(p,e),cv=curvature(p,e,old),raw=cv?clone(cv):null;if(raw?.type==='circle')raw.params[0]/=10;
   requireValue(Number.isFinite(length)&&length>1e-5,'degenerate edited edge');
   const edge={...clone(old),id:'e'+e.id,index:e.id,endpoints:[...e.endpoints],kind:e.kind,lengthMm:length,sampledPointsMm:pts,curvature:cv,sourceCurvatureCm:raw,samplingMaxNominalStepMm:8,samplingChordDeviationMm:.1};
   if(e.kind==='circle'){edge.arc=clone(e.arc);delete edge.controlPointsMm;}else{edge.controlPointsMm=clone(e.controlPointsMm);delete edge.arc;}
   lookup.set(p.sourcePanelId+':'+e.id,edge);return edge;
  });
  const edges=new Map(result.edges.map(e=>[e.index,e])),ordered=result.boundary.map(i=>edges.get(i));
  const polygon=ordered.flatMap(e=>e.sampledPointsMm.slice(0,-1));requireValue(polygon.length<=24000,'panel sampling budget exceeded');
  let area=0,gap=0;for(let i=0;i<polygon.length;i++)area+=polygon[i][0]*polygon[(i+1)%polygon.length][1]-polygon[(i+1)%polygon.length][0]*polygon[i][1];area/=2;
  for(let i=0;i<ordered.length;i++)gap=Math.max(gap,distance(result.verticesMm[ordered[i].endpoints[1]],result.verticesMm[ordered[(i+1)%ordered.length].endpoints[0]]));
  const crossings=intersectionPairs(polygon);if(Math.abs(area)<1e-3)errors.push({code:'DEGENERATE_AREA',panel:result.id});if(gap>1e-5)errors.push({code:'OPEN_BOUNDARY',panel:result.id,gapMm:gap});if(crossings.length)errors.push({code:'SAMPLED_SELF_INTERSECTION',panel:result.id,segmentPairs:crossings});
  result.signedAreaMm2=area;result.winding=area>0?'ccw':'cw';result.maxBoundaryGapMm=gap;result.selfIntersectionDiagnostic={method:'independent adaptive curve samples, <=0.1mm quarter-point deviation and <=8mm segments; strict proper crossings',crossings};
  return result;
 });
 const oldSeams=new Map(base.seams.map(s=>[s.id,s]));
 out.seams=document.stitches.map(s=>{const source=oldSeams.get(s.id);requireValue(source,'unknown source seam');const a={panelId:nativeId.get(s.a.panelId),edge:s.a.edgeId,reverse:s.a.reverse},b={panelId:nativeId.get(s.b.panelId),edge:s.b.edgeId,reverse:s.b.reverse};const ea=lookup.get(a.panelId+':'+a.edge),eb=lookup.get(b.panelId+':'+b.edge);requireValue(ea&&eb,'dangling edited seam');const g=clone(s.gathering);if(g){requireValue(g.ruffleCoefficientA>0&&g.ruffleCoefficientB>0,'invalid gathering');g.projectedLengthAMm=ea.lengthMm/g.ruffleCoefficientA;g.projectedLengthBMm=eb.lengthMm/g.ruffleCoefficientB;if(Math.abs(g.projectedLengthAMm-g.projectedLengthBMm)>3)warnings.push({code:'PROJECTED_SEAM_LENGTH_MISMATCH',seam:s.id,differenceMm:g.projectedLengthAMm-g.projectedLengthBMm,meaning:'retained for fresh sewing, not automatically corrected'});}
  return{...clone(source),a,b,lengthAMm:ea.lengthMm,lengthBMm:eb.lengthMm,easeMm:ea.lengthMm-eb.lengthMm,lengthRatioAOverB:ea.lengthMm/eb.lengthMm,gathering:g};
 });
 out.interfaces=[];out.darts=out.seams.filter(s=>s.isDart).map(s=>s.id);out.validation={analytic2DPass:errors.length===0,intersectionCheckRun:true,errors,warnings,physicalFitStatus:'not-run',continuousDomainCertified:false,originalRulesRechecked:false,explicitEditReferences:document.validation,scope:'edited geometry and source seam references; original garment-program assertions are not silently reused'};
 out.source={...out.source,sourceGeometryModified:document.revision>0,continuationEdits:{schema:document.schema,revision:document.revision,baseRecipeHash:base.recipeHash,baseGeometryHash:base.geometryHash,history:clone(document.editHistory),operations:clone(operations),originalBodyModified:false,requiresFreshDrape:true,sourceHighLevelInterfacesInvalidated:true}};
 out.recipeHash=await sha({bodyCm:base.bodyCm,design:base.design,baseRecipeHash:base.recipeHash,operations,editHistory:document.editHistory});
 out.geometryHash=await sha({panels:out.panels.map(p=>({id:p.id,verticesMm:p.verticesMm,edges:p.edges.map(e=>({index:e.index,endpoints:e.endpoints,kind:e.kind,controlPointsMm:e.controlPointsMm??null,arc:e.arc??null})),placement:p.placement})),seams:out.seams.map(s=>({id:s.id,a:s.a,b:s.b,gathering:s.gathering}))});
 out.officialOracleCm=null;out.diagnostics={...out.diagnostics,editingBackend:'inherited explicit-edit core + independently recomputed native-curve bridge',staleOriginalOracleRemoved:true,editedPatternHash:out.geometryHash};
 requireValue(errors.length===0,'edited paper failed 2D checks: '+errors.map(e=>e.code+':'+e.panel).join(', '));
 return out;
}
