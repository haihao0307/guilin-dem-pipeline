import {deriveAperture} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {patchDistance} from './kowloon-building-mother-r01/r07/cases.mjs';
import {hostOpening} from './building-rules.mjs';

/** Explicit design parameters, not measurements or a new window observation.
 * Merge these into the caller's Mother configuration. wallThickness is REQUIRED
 * from that same Mother and intentionally has no independent window default. */
export const SOURCE_HOSTED_WINDOW_DEFAULTS=Object.freeze({
 windowFrameDepth:.12,windowGlassThickness:.006,windowFrameWidth:.045,
 windowLeafThickness:.03,windowSashWidth:.025,windowMechanism:'fixed',
 windowOpenT:0,windowSurfaceOffset:.01,windowRevealMargin:.07,
 windowRevealInset:.006,windowRevealFront:.055,windowMaskInset:.012,
 windowMaskDepth:.05,
});
const clone=x=>structuredClone(x),add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),length=a=>Math.hypot(...a);
const finite=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]],Y=[0,1,0];
const IDENTITY=Object.freeze({origin:[0,0,0],u:[1,0,0],v:[0,1,0],w:[0,0,1]});
function rigid(frame){
 const f=clone(frame??IDENTITY);if(!finite(f.origin,3)||[f.u,f.v,f.w].some(a=>!finite(a,3)||Math.abs(length(a)-1)>1e-8)||Math.abs(dot(f.u,f.v))+Math.abs(dot(f.u,f.w))+Math.abs(dot(f.v,f.w))>1e-8)throw Error('Host placement must be finite rigid axes, not scale/shear');
 const cross=[f.u[1]*f.v[2]-f.u[2]*f.v[1],f.u[2]*f.v[0]-f.u[0]*f.v[2],f.u[0]*f.v[1]-f.u[1]*f.v[0]];if(dot(cross,f.w)<1-1e-8)throw Error('Host placement must preserve handedness');return f;
}
function pointInRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const a=ring[j],b=ring[i],d=sub(b,a),q=sub(p,a),t=dot(q,d)/dot(d,d);if(t>=-1e-8&&t<=1+1e-8&&Math.abs(d[0]*q[1]-d[1]*q[0])<=1e-7)return true;
 if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;}
export function validateSourceHostedWindowDimensions(d){
 if(!d||!Number.isFinite(d.wallThickness)||d.wallThickness<=0)throw Error('Explicit Mother wallThickness required');
 for(const k of Object.keys(SOURCE_HOSTED_WINDOW_DEFAULTS)){if(k==='windowMechanism')continue;if(!Number.isFinite(d[k])||(k==='windowOpenT'?d[k]<0||d[k]>1:d[k]<=0))throw Error('Explicit finite Mother dimension required: '+k);}
 if(!['fixed','hinge-left','hinge-right','slider-left','slider-right'].includes(d.windowMechanism))throw Error('Explicit design window mechanism required');
 if(d.windowMechanism==='fixed'&&d.windowOpenT!==0)throw Error('Fixed design preview cannot have opening motion');
 const ranges={wallThickness:[.05,.5],windowFrameDepth:[.04,.3],windowGlassThickness:[.002,.02],windowFrameWidth:[.02,.12],windowLeafThickness:[.02,.08],windowSashWidth:[.012,.08],windowSurfaceOffset:[.001,.05],windowRevealMargin:[.02,.15],windowRevealInset:[.001,.02],windowRevealFront:[.01,.12],windowMaskInset:[.002,.04],windowMaskDepth:[.01,.1]};
 for(const [key,[min,max]]of Object.entries(ranges))if(d[key]<min||d[key]>max)throw Error('Mother dimension outside tested design domain: '+key);
 if(d.windowGlassThickness>d.windowLeafThickness)throw Error('Design glass thickness cannot exceed its leaf');
 return clone(d);
}

/** One host-local recipe drives hole, emitted frame/leaf/glass, reveal and mask.
 * sourcePatch.sourceModelId and hostBoundary.sourceModelId must be supplied by
 * the containing source model, without mutating the frozen source object.
 * hostBoundary: {id,modelRootId,sourceModelId,sourcePatchId,instanceId,a,b,segments?,placement?}
 * a/b/segments are the existing design-wall source-local X/Z boundaries.
 * placement is optional rigid inspection placement ONLY; it never changes source
 * evidence, real floor levels, model scale or actual building registration.
 */
export function deriveSourceHostedWindow({observation,sourcePatch,designFloor,hostBoundary,dimensions}={}){
 const f=observation,h=hostBoundary,d=validateSourceHostedWindowDimensions(dimensions);
 if(f?.schema!=='kaopu.observed-opening-field/1'||typeof f.id!=='string'||!f.id||!f.sourceModelId||!f.sourcePatchId||!sourcePatch||!h)throw Error('Source-backed opening observation and host required');
 if(f.sourceModelId!==sourcePatch.sourceModelId||f.sourceModelId!==h.sourceModelId||f.sourcePatchId!==sourcePatch.sourcePatchId||f.sourcePatchId!==h.sourcePatchId||f.sourceObjectId!==sourcePatch.objectId)throw Error('Observation/source/host identity mismatch');
 if(!h.id||!h.modelRootId||!Number.isInteger(h.instanceId)||h.instanceId<0||h.instanceId>511)throw Error('Explicit stable host identity and aperture instanceId required');
 if(!designFloor?.id||!designFloor.nodeId||!Number.isFinite(designFloor.elevation))throw Error('Existing design floor required; actual floor assignment remains unknown');
 if(!Array.isArray(f.localRing)||f.localRing.length!==4||f.localRing.some(p=>!finite(p,2)))throw Error('Reviewed finite four-corner observation required');
 const frame=f.sourceFrame;if(!frame||[frame.origin,frame.u,frame.v,frame.n].some(v=>!finite(v,3)))throw Error('Observed source frame required');
 for(const k of ['origin','u','v','n'])if(!finite(sourcePatch[k],3)||length(sub(frame[k],sourcePatch[k]))>1e-7)throw Error('Observation frame differs from source plane');
 if(Math.abs(dot(frame.v,Y)-1)>1e-7||Math.abs(frame.u[1])>1e-7||Math.abs(frame.n[1])>1e-7)throw Error('This floor-bound adapter requires an upright source wall, not a guessed sloped-wall mapping');
 const sourcePoint=q=>add(frame.origin,add(mul(frame.u,q[0]),mul(frame.v,q[1])));
 if(f.localRing.some(q=>patchDistance(sourcePatch,sourcePoint(q))>1e-7))throw Error('Observation leaves finite original source face');
 const us=f.localRing.map(p=>p[0]),left=Math.min(...us),right=Math.max(...us),bottom=Math.max(...f.localRing.slice(2).map(p=>p[1])),top=Math.min(...f.localRing.slice(0,2).map(p=>p[1]));
 if(!(right>left&&top>bottom)||rect(left,bottom,right,top).some(q=>!pointInRing(q,f.localRing)))throw Error('No supported inscribed rectangular design opening');
 const width=right-left,height=top-bottom,sourceCenter=sourcePoint([(left+right)/2,(bottom+top)/2]),sill=sourceCenter[1]-height/2-designFloor.elevation;
 if(sill<0)throw Error('Observed opening conflicts with retained design floor; do not silently move the floor');
 if(Number.isFinite(designFloor.clearHeight)&&sill+height>designFloor.clearHeight+1e-7)throw Error('Observed opening exceeds retained design storey clear height');
 const placement=rigid(h.placement),direction=p=>add(mul(placement.u,p[0]),add(mul(placement.v,p[1]),mul(placement.w,p[2]))),world=p=>add(placement.origin,direction(p));
 const poseAt=origin=>({origin:world(origin),u:direction(frame.u),v:direction(frame.v),w:direction(frame.n)});
 const infillId=h.modelRootId+':source-window-proposal:'+f.id,openingId=infillId+':opening',pose=poseAt(sourceCenter);
 const patchUs=sourcePatch.loops[0].map(p=>p[0]),pa=sourcePoint([Math.min(...patchUs),0]),pb=sourcePoint([Math.max(...patchUs),0]);
 const openingRule={...hostOpening({a:[pa[0],pa[2]],b:[pb[0],pb[2]],center:[sourceCenter[0],sourceCenter[2]],width,height,sill,wallThickness:d.wallThickness}),pose,corners:rect(-width/2,-height/2,width/2,height/2).map(p=>world(add(sourceCenter,add(mul(frame.u,p[0]),mul(frame.v,p[1]))))),evidence:'source_supported_inscribed_design_rectangle_not_actual_frame'};
 const apertureConfig={instanceId:h.instanceId,kind:'window',width,height,frameWidth:d.windowFrameWidth,frameDepth:d.windowFrameDepth,wallThickness:d.wallThickness,leafThickness:d.windowLeafThickness,sashWidth:d.windowSashWidth,glassThickness:d.windowGlassThickness,hingeOrSlider:d.windowMechanism,openT:d.windowOpenT,host:{nodeId:infillId,sourcePatchId:f.sourcePatchId,sourceObjectId:f.sourceObjectId,...poseAt(add(sourceCenter,mul(frame.n,d.windowSurfaceOffset))),emitWall:false}};
 const aperture=deriveAperture(apertureConfig);aperture.floorId=designFloor.id;aperture.bindingKey=f.id;aperture.observationId=f.id;
 const parts=aperture.primitives.filter(p=>['frame','leaf','glass'].includes(p.part)).map(p=>{const id=infillId+':part:'+p.part;p.semanticPartNodeId=id;return{id,type:p.part,objectId:p.objectId,...(p.part==='glass'?{parentId:infillId+':part:leaf'}:{})};});
 const ownershipSpec={buildingId:f.sourceModelId,wallId:h.id,openingId,infillId,infillType:'window',parts};
 const segments=h.segments??[h];if(!segments.length||segments.some(w=>!finite(w.a,2)||!finite(w.b,2)))throw Error('Existing design host boundary segments required');
 const wallCuts=[];for(const w of segments){const delta=sub(w.b,w.a),span=length(delta);if(span<1e-7)throw Error('Zero-length design host');const axis=mul(delta,1/span),at=dot(sub([sourceCenter[0],sourceCenter[2]],w.a),axis),projectedWidth=width*Math.abs(dot(axis,[frame.u[0],frame.u[2]])),lo=Math.max(0,at-projectedWidth/2),hi=Math.min(span,at+projectedWidth/2);if(hi-lo<=1e-7)continue;
  const center=add(w.a,mul(axis,(lo+hi)/2)),local={center,width:hi-lo,sill,height,observationId:f.id};
  const segmentDepth=dot(sub([center[0],sourceCenter[1],center[1]],sourceCenter),frame.n)+d.wallThickness/2;
  if(Math.abs(segmentDepth)>1)throw Error('Projected segment is not the named nearby design host');
  wallCuts.push({boundaryKey:w.key??w.id,sourceLocal:local,worldCenter:world([center[0],sourceCenter[1],center[1]]),wallThickness:d.wallThickness});
 }
 if(!wallCuts.length)throw Error('Observed opening does not project onto the named design host');
 if(!finite(h.a,2))throw Error('Reference design boundary point required');
 const depth=dot(sub([h.a[0],sourceCenter[1],h.a[1]],sourceCenter),frame.n)+d.wallThickness/2;
 if(depth<.1||depth>1)throw Error('Source/design reveal delta outside audited design range');
 const rw=width/2,rh=height/2,revealSpec={id:infillId+':reveal',nodeId:'complete-window-reveal:'+f.id,loops:[rect(-rw-d.windowRevealMargin,-rh-d.windowRevealMargin,rw+d.windowRevealMargin,rh+d.windowRevealMargin),rect(-rw+d.windowRevealInset,-rh+d.windowRevealInset,rw-d.windowRevealInset,rh-d.windowRevealInset)],range:[-d.windowRevealFront,depth],pose,depthM:depth,actualDepth:null};
 const mask={instanceId:h.instanceId,hostId:infillId,sourcePatchId:f.sourcePatchId,sourceObjectId:f.sourceObjectId,frame:clone(aperture.host),width:width-d.windowMaskInset,height:height-d.windowMaskInset,depth:d.windowMaskDepth,roundRadius:0,enabled:true,floorId:designFloor.id,scope:'design_proposal_only_inscribed_inside_source_observation',sourceGeometryDeleted:false};
 if(mask.width<=0||mask.height<=0)throw Error('Mask inset consumes observation');
 return{schema:'kaopu.source-hosted-window/1',observationId:f.id,sourceModelId:f.sourceModelId,sourcePatchId:f.sourcePatchId,sourceFrame:clone(frame),dimensions:d,sourceLocal:{center:sourceCenter,width,height,bottom:sourceCenter[1]-height/2,top:sourceCenter[1]+height/2},placement,openingRule,apertureConfig,aperture,revealSpec,wallCuts,mask,ownershipSpec,
  evidence:{geometry:'source_projected_observation_plus_authored_joinery',actualMechanism:null,realFloorAssignment:null,actualIndoorFFLVerified:false,actualDimensions:null,designFloorId:designFloor.id,designMechanism:d.windowMechanism,sourceEvidenceUnchanged:true,sourceGeometryChanged:false,modelTriangles:0,structuralCertification:false}};
}

/** Read-only placement invariant: catches correct ownership with stale geometry. */
export function validateSourceHostedWindowPlacement(result){
 const errors=[],f=result?.openingRule?.pose;if(!f)return{passed:false,errors:['missing opening pose']};
 const expected=add(f.origin,mul(f.w,result.dimensions.windowSurfaceOffset));
 const same=(a,b)=>finite(a,3)&&finite(b,3)&&length(sub(a,b))<1e-7;
 if(!same(result.aperture.host.origin,expected))errors.push('stale aperture host origin');
 if(!same(result.apertureConfig.host.origin,expected))errors.push('stale aperture recipe origin');
 for(const k of ['u','v','w'])if(!same(result.aperture.host[k],f[k]))errors.push('stale aperture host '+k);
 if(!same(result.revealSpec.pose.origin,f.origin))errors.push('stale reveal origin');
 for(const k of ['u','v','w'])if(!same(result.revealSpec.pose[k],f[k]))errors.push('stale reveal '+k);
 if(!same(result.mask.frame.origin,expected))errors.push('stale opening mask origin');
 const placement=rigid(result.placement),direction=p=>add(mul(placement.u,p[0]),add(mul(placement.v,p[1]),mul(placement.w,p[2]))),world=p=>add(placement.origin,direction(p));
 if(!same(f.origin,world(result.sourceLocal.center)))errors.push('stale opening origin relative to parent');
 for(const [k,sk]of [['u','u'],['v','v'],['w','n']])if(!same(f[k],direction(result.sourceFrame[sk])))errors.push('stale opening axis relative to parent');
 const corners=rect(-result.sourceLocal.width/2,-result.sourceLocal.height/2,result.sourceLocal.width/2,result.sourceLocal.height/2).map(p=>add(f.origin,add(mul(f.u,p[0]),mul(f.v,p[1]))));
 if(corners.some((p,i)=>!same(p,result.openingRule.corners[i])))errors.push('stale opening corners');
 const fresh=deriveAperture(result.apertureConfig);
 for(const p of result.aperture.primitives){const q=fresh.primitives.find(x=>x.part===p.part);if(!q||!['origin','u','v','w'].every(k=>same(p[k],q[k])))errors.push('stale emitted '+p.part+' world pose');}
 return{passed:errors.length===0,errors};
}
