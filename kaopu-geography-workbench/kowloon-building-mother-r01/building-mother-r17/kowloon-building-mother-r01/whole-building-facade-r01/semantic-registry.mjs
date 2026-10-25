import {materialForRecord} from '../../facade-materials.mjs';
import {relationForPatch} from '../../source-relations.mjs';
/** Semantic output only. No geometry creation and no material-based classification. */
export const CLASSES=[
 {key:'UNKNOWN',label:'UNKNOWN 未识别',color:'#b8b5bc'},
 {key:'wall',label:'墙',color:'#d8bdb5'},
 {key:'column',label:'柱（设计实体）',color:'#dac4a4'},
 {key:'beam',label:'梁（设计实体）',color:'#d6d1ad'},
 {key:'stair',label:'楼梯 / 梯平台',color:'#d0b8cb'},
 {key:'floor',label:'楼板 / 地面',color:'#b9ccba'},
 {key:'roof',label:'屋面 / 顶面',color:'#bfc1db'},
 {key:'elevator',label:'电梯构件 / 接口',color:'#b0cbd1'},
 {key:'door',label:'门',color:'#c9b292'},
 {key:'window',label:'窗',color:'#adc2da'},
 // Append only: inspection colors are not material or geometry identities.
 {key:'handrail',label:'扶手 / 接头 / 立柱',color:'#536477'},
 {key:'grille',label:'观察格栅 / 分格',color:'#855558'},
 {key:'equipment',label:'设备可见前壳',color:'#deded5'},
 {key:'equipment_recess',label:'格栅背衬 / 设备风扇区',color:'#61686c'}
];
export const SEMANTIC_COLORS=['#96959c','#bf9a92','#ceaf65','#e3c991','#83b995','#9aa6d6','#b69bc9','#d69bba','#d3b381','#79b9cc','#53688e','#b38396','#98b9aa','#647675'];
export const classIndex=key=>Math.max(0,CLASSES.findIndex(c=>c.key===key));
export const HANDRAIL_PART_ROLES=Object.freeze(['continuous_handrail_segment','handrail_node_join','handrail_support_post']);
export function classifyPrimitive(p,instance={},node=null){
 // A specific authored role may refine a legacy broad `stair` class. Never
 // infer a rail from its color, width, position, or a substring in its ID.
 if(p.semanticClass==='handrail'||node?.semanticClass==='handrail'||HANDRAIL_PART_ROLES.includes(p.partRole)||HANDRAIL_PART_ROLES.includes(node?.partRole))return'handrail';
 if(p.semanticClass&&CLASSES.some(c=>c.key===p.semanticClass))return p.semanticClass;const n=p.nodeId??'',a=instance.archetypeId??'';
 if(/^(freight-car|freight-door|freight-dock)$/.test(a)||/lift-(car|door|dock)|car-panel|landing-door/.test(n))return'elevator';
 if(instance.kind==='stair'||/stair-connection:|^stair:/.test(n)||n==='platform')return'stair';
 if(n==='floor:slab'||/^study-floor:|:upper-slab$|:lower-slab$|:threshold$/.test(n)||n==='loading:bay')return'floor';
 if(/^study-wall:|^evidence-core:|^evidence-outline:wall:|^freight:(front|back|side)|house-wall|podium-perimeter|partition|source-lift-core|design-entry-wall/.test(n)||n==='loading:divider')return'wall';
 if(/^evidence-window:/.test(n))return'window';
 // Gate posts/lintels are not evidence of structural columns/beams.
 return'UNKNOWN';
}
export function designDimensions(p,classKey){
 const span=p.range?.length===2?Math.abs(p.range[1]-p.range[0])*Math.hypot(...(p.w??[0,0,0])):null;
 const unit=p.w?Math.abs(p.w[1])/Math.hypot(...p.w):null;
 const wallThickness=classKey==='wall'&&unit!==null&&unit<1e-6?span:null;
 const slabThickness=classKey==='floor'&&unit!==null&&unit>1-1e-6?span:null;
 return {actualThicknessM:null,designWallThicknessM:wallThickness,designSlabThicknessM:slabThickness,extrusionSpanM:span,extrusionDirection:p.w??null,thicknessExplanation:wallThickness!==null?'当前自建设计墙厚，不是现实墙厚':slabThickness!==null?'当前自建设计板/地面层厚度，不是实测':classKey==='wall'?'有限实体；挤出跨度不等于墙厚，当前墙厚未单独确定':'当前设计实体；实际构造未知'};
}
export function buildRegistry(model,measured){
 const root=model.graph.nodes[0].id, byNode=new Map(model.graph.nodes.map(n=>[n.id,n])), owners=new Map(model.graph.edges.filter(e=>e.type==='ownedBy').map(e=>[e.from,e.to]));
 const records=[],used=new Map(),frame=model.placementMode==='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'?'plan-local 未配准':'source-local';
 const push=r=>{if(used.has(r.objectId))throw Error('Ambiguous render object ID '+r.objectId+': '+used.get(r.objectId).id+' / '+r.id);r.classIndex=classIndex(r.classKey);r.color=CLASSES[r.classIndex].color;records.push(r);used.set(r.objectId,r);};
 for(const p of measured.patches){const node=model.graph.nodes.find(n=>n.sourcePatchId===p.sourcePatchId);const cls=p.sourceKind.startsWith('wall')?'wall':p.sourceKind==='roofPlane'?'roof':'UNKNOWN';push({objectId:p.objectId,id:node?.id??measured.sourceModelId+':source:'+p.sourcePatchId,nodeId:node?.id??null,ownerId:node?owners.get(node.id):measured.sourceModelId,buildingId:measured.sourceModelId,classKey:cls,geometryEvidence:'observed 源面几何',classEvidence:cls==='UNKNOWN'?'unknown 未确认用途':'inferred 仅由源面朝向推定',evidence:'unsigned-shell-surface，非已识别厚墙/结构楼板',sourcePatchId:p.sourcePatchId,sourceKind:p.sourceKind,frame:'source-local',floorId:null,actualThicknessM:null,sourceRef:'r07/cases.mjs: deriveMeasuredCase',geometryKind:'unsigned-shell-surface',modeledThicknessM:0,thicknessExplanation:'当前源模型是零厚有限面；真实墙厚/屋面构造未知',bounds:p.bounds,...relationForPatch(p,measured.sourceModelId)});}
 for(const [ix,i]of model.instances.entries()){const a=model.archetypes.find(a=>a.id===i.archetypeId);for(const p of a.primitives){const bound=i.nodeBindings?.[p.nodeId]??(byNode.has(p.nodeId)?p.nodeId:null),node=byNode.get(bound);push({objectId:p.objectId+(i.objectIdOffset??10000*(ix+1)),id:i.id+'::primitive:'+p.objectId,nodeId:bound??p.nodeId,ownerId:(bound?owners.get(bound)??bound:null)??model.levels.find(l=>l.id===i.floorId)?.nodeId??root,sourceOwnerId:bound?owners.get(bound)??null:null,buildingId:model.sourceModelId??measured.sourceModelId,classKey:classifyPrimitive(p,i,node),geometryEvidence:'design 自有设计形体',classEvidence:'design 源函数角色',evidence:node?.evidence??'自建设计，不是实楼构件识别或结构认证',sourcePatchId:node?.sourcePatchId??null,focusNormal:node?.type==='unclassified_facade_panel'?p.w:null,prototypeNodeId:p.nodeId,instanceId:i.id,archetypeId:a.id,frame,floorId:i.floorId,sourceRef:'原有 archetype / instance / nodeBindings',geometryKind:p.kind,...designDimensions(p,classifyPrimitive(p,i,node)),bounds:p.bounds?{min:p.bounds.min.map((v,k)=>v+(i.translation?.[k]??0)),max:p.bounds.max.map((v,k)=>v+(i.translation?.[k]??0))}:i.bounds});}}
 const apertures=(model.floorStudy??model.hostedComponents)?.apertures??[];
 for(const a of apertures)for(const p of a.primitives){const host=a.host.nodeId;let cls=p.part==='host'?'wall':/:lift:/.test(host)?'elevator':a.kind==='door'?'door':'window';const ambiguous=/F-E04-0[23]/.test(host);if(ambiguous&&p.part!=='host')cls='UNKNOWN';push({objectId:p.objectId,id:(model.sourceModelId??measured.sourceModelId)+'::aperture:'+a.instanceId+':part:'+p.objectId,nodeId:host,ownerId:host,buildingId:model.sourceModelId??measured.sourceModelId,classKey:cls,geometryEvidence:'design 自有参数形体',classEvidence:ambiguous?'unknown 窗或阳台门未区分':'design 既有门窗/接口角色',evidence:ambiguous?'观察到玻璃开口，但类型未确认；不能按生成器 window 字段冒认。':'门窗位置与尺寸仍为设计或临时拟合；非实测复原',part:p.part,instanceId:a.instanceId,frame,floorId:a.floorId??null,sourceRef:'r07/apertures.mjs: deriveAperture',focusNormal:(a.focusNormal??a.host.w??p.w)?.map(v=>v*(measured.sourceModelId==='B367642137201063C0'&&a.kind==='door'?-1:1)),geometryKind:p.kind,designComponentDimensions:{width:a.config?.width??null,height:a.config?.height??null,wallThickness:a.config?.wallThickness??null,frameDepth:a.config?.frameDepth??null},bounds:p.bounds});}
 for(const [k,s]of model.interfaces.stairs.entries())push({objectId:30000+k,id:s.id+':rail',nodeId:s.id,ownerId:s.id,buildingId:model.sourceModelId??measured.sourceModelId,classKey:'handrail',geometryEvidence:'design 自有中心线扶手',classEvidence:'design 明确扶手函数角色',evidence:'原渲染器将整套扶手写入一个 hit ID；单根子件不能从当前 hit ID 单独区分',frame,floorId:s.fromFloorId,sourceRef:'whole-building-ground-r01/rails.mjs'});
 records.sort((a,b)=>a.objectId-b.objectId);return records;
}
export function packRegistry(records){const width=Math.max(1,records.length),data=new Float32Array(width*200);records.forEach((r,i)=>{const c=r.color.slice(1).match(/../g).map(x=>parseInt(x,16)/255);data.set([r.objectId,...c],i*4);data.set([r.classIndex,0,0,0],(width+i)*4);const sc=SEMANTIC_COLORS[r.classIndex].slice(1).match(/../g).map(x=>parseInt(x,16)/255);data.set([...sc,1],(2*width+i)*4);const mat=materialForRecord(r),rgb=x=>x.slice(1).match(/../g).map(v=>parseInt(v,16)/255);data.set([...rgb(mat.color),mat.type],(3*width+i)*4);data.set([...rgb(mat.accent),(r.materialBands??[]).length],(4*width+i)*4);data.set(r.materialFrame??[0,0,0,0],(5*width+i)*4);(r.materialBands??[]).forEach((b,k)=>data.set(b,((6+k)*width+i)*4));});return{width,height:50,data};}
/** Neutral technical form cue, not a physical material/light model. All source fields stay unchanged. */
export const SEMANTIC_SHADE=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D uHit,uNormal,uSemantic;uniform int uSemanticCount,uSemanticMode,uMaterialMode,uMaterialBands;uniform float uSelectedId;
uniform vec2 uInspectionLights;uniform vec3 uCameraEye,uTarget;uniform float uFov;uniform vec2 uResolution;uniform ivec4 uTile;
out vec4 outColor;
vec3 ray(){vec2 uv=(2.*gl_FragCoord.xy-uResolution)/uResolution.y;vec3 f=normalize(uTarget-uCameraEye),r=normalize(cross(f,abs(f.y)>.999?vec3(0,0,1):vec3(0,1,0)));return normalize(f+tan(uFov*.5)*(uv.x*r+uv.y*cross(r,f)));}
void main(){ivec2 px=ivec2(gl_FragCoord.xy);vec4 h=texelFetch(uHit,px,0);if(h.w<.5){outColor=vec4(.43,.44,.45,1.);return;}if(h.w>2.5){outColor=vec4(.8,.05,.4,1.);return;}
int recordIndex=-1;int materialType=0;vec3 accent=vec3(.7);int kind=0;int lo=0,hi=uSemanticCount-1;vec3 c=vec3(.72,.71,.74);for(int k=0;k<20;k++){if(lo>hi)break;int m=(lo+hi)/2;vec4 r=texelFetch(uSemantic,ivec2(m,0),0);if(abs(r.x-h.y)<.1){c=uSemanticMode>0?texelFetch(uSemantic,ivec2(m,2),0).xyz:r.yzw;kind=int(texelFetch(uSemantic,ivec2(m,1),0).x);if(uSemanticMode==0&&uMaterialMode>0){vec4 mat=texelFetch(uSemantic,ivec2(m,3),0);recordIndex=m;c=mat.xyz;materialType=int(mat.w);accent=texelFetch(uSemantic,ivec2(m,4),0).xyz;}break;}if(r.x<h.y)lo=m+1;else hi=m-1;}
vec3 n=normalize(texelFetch(uNormal,px,0).xyz),rd=ray();if(dot(n,rd)>0.)n=-n;
// New warehouse equipment only: fixed world-space low-amplitude authored variation.
// Not a scan of historic dirt, not PBR, and not applied to other building materials.
if(uSemanticMode==0&&(kind==11||kind==12)){vec3 wp=uCameraEye+rd*h.x;float grain=sin(dot(wp,vec3(13.1,19.7,11.3)))*sin(dot(wp,vec3(7.7,3.1,17.9)));c*=1.0+.025*grain;}
// Constant-cost analytic finish. Fine joints fade to their area average below a pixel.
if(uSemanticMode==0&&uMaterialMode>0&&materialType>0){
 vec3 wp=uCameraEye+rd*h.x;vec2 uv=abs(n.x)>abs(n.z)?wp.zy:wp.xy;
 float grain=sin(dot(wp,vec3(13.1,19.7,11.3)))*sin(dot(wp,vec3(7.7,3.1,17.9)));
 if(materialType==2&&(wp.y<4.782377||wp.y>67.178628)){materialType=1;}
 if((materialType==2&&uMaterialBands>0)||materialType==3){int count=int(texelFetch(uSemantic,ivec2(recordIndex,4),0).w),l=0,r=count-1,last=-1;for(int k=0;k<6;k++){if(l>r)break;int mid=(l+r)/2;vec4 band=texelFetch(uSemantic,ivec2(recordIndex,6+mid),0);if(band.z<=wp.y){last=mid;l=mid+1;}else r=mid-1;}vec4 frame=texelFetch(uSemantic,ivec2(recordIndex,5),0);float u=dot(wp.xz-frame.xy,frame.zw);for(int k=0;k<2;k++){int j=last-k;if(j<0)break;vec4 band=texelFetch(uSemantic,ivec2(recordIndex,6+j),0);if(u>=band.x&&u<=band.y&&wp.y>=band.z&&wp.y<=band.w)c=accent;}}
 if(materialType==1)c*=1.;
 else if(materialType==4){float detail=sin(wp.y*41.+sin(wp.x*13.)*.5)*sin(wp.z*16.+wp.y*9.);c*=1.+.015*detail*(1.-smoothstep(.03,.12,length(fwidth(wp))));float sheen=pow(max(dot(n,normalize(-rd+vec3(.3,.8,.6))),0.),24.);c+=vec3(.035)*sheen;}
 else{vec2 pitch=materialType==2?vec2(.19,.055):vec2(.10,.045);vec2 q=uv/pitch;float row=floor(q.y);q.x+=(materialType==2?0.:mod(row,2.)*.5);vec2 d=min(fract(q),1.-fract(q));vec2 aa=max(fwidth(q),vec2(.0001));vec2 joint=vec2(.0015)/pitch;
 vec2 coverage=1.-smoothstep(joint-aa*.5,joint+aa*.5,d);float visible=1.-smoothstep(.3,1.2,max(aa.x,aa.y));float joints=mix(.045,max(coverage.x,coverage.y),visible);c*=1.-.16*joints;c*=1.+.008*grain*(1.-smoothstep(.1,.7,length(fwidth(wp))));
 // Existing source folds provide real ribs; coloring is a replaceable visual hypothesis.
 if(materialType==3&&abs(n.y)>.28)c=accent*(1.-.08*joints);
 }
}
// Fixed neutral normal-based shape cue only: no PBR, surface texture, shadow ray, or roughness.
vec3 rawRight=cross(normalize(uTarget-uCameraEye),vec3(0.,1.,0.));vec3 right=length(rawRight)>.0001?normalize(rawRight):vec3(1.,0.,0.);vec3 front=normalize(uCameraEye-uTarget);vec3 cool=normalize(-right*.75+vec3(0.,1.15,0.)+front*.55),warm=normalize(right*.85+vec3(0.,.32,0.)+front*.6);vec3 illumination=vec3(.48)+uInspectionLights.x*.29*max(dot(n,cool),0.)*vec3(.82,.91,1.)+uInspectionLights.y*.21*max(dot(n,warm),0.)*vec3(1.,.88,.73);c*=illumination;
bool edge=false,selection=false;for(int a=0;a<4;a++){ivec2 d=a==0?ivec2(1,0):a==1?ivec2(-1,0):a==2?ivec2(0,1):ivec2(0,-1);ivec2 q=px+d;if(any(lessThan(q,uTile.xy))||any(greaterThanEqual(q,uTile.xy+uTile.zw)))continue;vec4 nh=texelFetch(uHit,q,0);bool boundary=abs(nh.y-h.y)>.1;if(boundary&&(abs(h.y-uSelectedId)<.1||abs(nh.y-uSelectedId)<.1))selection=true;if(nh.w<.5)edge=true;else{vec3 nn=normalize(texelFetch(uNormal,q,0).xyz);if(dot(nn,rd)>0.)nn=-nn;if(dot(n,nn)<.78)edge=true;}}
if(edge)c*=.80;if(abs(h.y-uSelectedId)<.1)c=mix(c,vec3(.98,.91,.60),.12);if(selection)c=vec3(.16,.24,.32);
outColor=vec4(c,1.);}
`;
export const SEMANTIC_PRESENT=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D uColor;uniform vec2 uPresentResolution;out vec4 outColor;
void main(){ivec2 s=textureSize(uColor,0);ivec2 p=min(s-1,ivec2(gl_FragCoord.xy/uPresentResolution*vec2(s)));outColor=texelFetch(uColor,p,0);}
`;
