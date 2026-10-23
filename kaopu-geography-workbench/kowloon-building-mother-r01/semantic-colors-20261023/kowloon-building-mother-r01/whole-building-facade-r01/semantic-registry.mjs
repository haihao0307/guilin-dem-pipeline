/** Semantic output only. No geometry creation and no material-based classification. */
export const CLASSES=[
 {key:'UNKNOWN',label:'UNKNOWN 未识别',color:'#ff00ff'},
 {key:'wall',label:'墙',color:'#ed4245'},
 {key:'column',label:'柱（未识别）',color:'#ff8c00'},
 {key:'beam',label:'梁（未识别）',color:'#ffe600'},
 {key:'stair',label:'楼梯 / 梯平台 / 扶手',color:'#ff66b2'},
 {key:'floor',label:'楼板 / 地面',color:'#19b85b'},
 {key:'roof',label:'屋面 / 顶面',color:'#7b61ff'},
 {key:'elevator',label:'电梯构件 / 接口',color:'#00bcd4'},
 {key:'door',label:'门',color:'#996633'},
 {key:'window',label:'窗',color:'#247bff'}
];
export const classIndex=key=>Math.max(0,CLASSES.findIndex(c=>c.key===key));
export function classifyPrimitive(p,instance){
 const n=p.nodeId??'',a=instance.archetypeId??'';
 if(/^(freight-car|freight-door|freight-dock)$/.test(a)||/lift-(car|door|dock)|car-panel|landing-door/.test(n))return'elevator';
 if(instance.kind==='stair'||/stair-connection:|^stair:/.test(n)||n==='platform')return'stair';
 if(n==='floor:slab'||/^study-floor:|:upper-slab$|:lower-slab$|:threshold$/.test(n)||n==='loading:bay')return'floor';
 if(/^study-wall:|^evidence-core:|^evidence-outline:wall:|^freight:(front|back|side)|house-wall|podium-perimeter|partition|source-lift-core|design-entry-wall/.test(n)||n==='loading:divider')return'wall';
 if(/^evidence-window:/.test(n))return'window';
 // Gate posts/lintels are not evidence of structural columns/beams.
 return'UNKNOWN';
}
export function buildRegistry(model,measured){
 const root=model.graph.nodes[0].id, byNode=new Map(model.graph.nodes.map(n=>[n.id,n])), owners=new Map(model.graph.edges.filter(e=>e.type==='ownedBy').map(e=>[e.from,e.to]));
 const records=[],used=new Map(),frame=model.placementMode==='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother'?'plan-local 未配准':'source-local';
 const push=r=>{if(used.has(r.objectId))throw Error('Ambiguous render object ID '+r.objectId+': '+used.get(r.objectId).id+' / '+r.id);r.classIndex=classIndex(r.classKey);r.color=CLASSES[r.classIndex].color;records.push(r);used.set(r.objectId,r);};
 for(const p of measured.patches){const node=model.graph.nodes.find(n=>n.sourcePatchId===p.sourcePatchId);const cls=p.sourceKind.startsWith('wall')?'wall':p.sourceKind==='roofPlane'?'roof':'UNKNOWN';push({objectId:p.objectId,id:node?.id??measured.sourceModelId+':source:'+p.sourcePatchId,nodeId:node?.id??null,ownerId:node?owners.get(node.id):measured.sourceModelId,buildingId:measured.sourceModelId,classKey:cls,geometryEvidence:'observed 源面几何',classEvidence:cls==='UNKNOWN'?'unknown 未确认用途':'inferred 仅由源面朝向推定',evidence:'unsigned-shell-surface，非已识别厚墙/结构楼板',sourcePatchId:p.sourcePatchId,sourceKind:p.sourceKind,frame:'source-local',floorId:null,actualThicknessM:null,sourceRef:'r07/cases.mjs: deriveMeasuredCase',bounds:p.bounds});}
 for(const [ix,i]of model.instances.entries()){const a=model.archetypes.find(a=>a.id===i.archetypeId);for(const p of a.primitives){const bound=i.nodeBindings?.[p.nodeId]??(byNode.has(p.nodeId)?p.nodeId:null),node=byNode.get(bound);push({objectId:p.objectId+(i.objectIdOffset??10000*(ix+1)),id:i.id+'::primitive:'+p.objectId,nodeId:bound??p.nodeId,ownerId:bound??model.levels.find(l=>l.id===i.floorId)?.nodeId??root,sourceOwnerId:bound?owners.get(bound)??null:null,buildingId:model.sourceModelId??measured.sourceModelId,classKey:classifyPrimitive(p,i),geometryEvidence:'design 自有设计形体',classEvidence:'design 源函数角色',evidence:node?.evidence??'自建设计，不是实楼构件识别或结构认证',prototypeNodeId:p.nodeId,instanceId:i.id,archetypeId:a.id,frame,floorId:i.floorId,sourceRef:'原有 archetype / instance / nodeBindings',bounds:i.bounds});}}
 const apertures=(model.floorStudy??model.hostedComponents)?.apertures??[];
 for(const a of apertures)for(const p of a.primitives){const host=a.host.nodeId;let cls=p.part==='host'?'wall':/:lift:/.test(host)?'elevator':a.kind==='door'?'door':'window';const ambiguous=/F-E04-0[23]/.test(host);if(ambiguous&&p.part!=='host')cls='UNKNOWN';push({objectId:p.objectId,id:(model.sourceModelId??measured.sourceModelId)+'::aperture:'+a.instanceId+':part:'+p.objectId,nodeId:host,ownerId:host,buildingId:model.sourceModelId??measured.sourceModelId,classKey:cls,geometryEvidence:'design 自有参数形体',classEvidence:ambiguous?'unknown 窗或阳台门未区分':'design 既有门窗/接口角色',evidence:ambiguous?'观察到玻璃开口，但类型未确认；不能按生成器 window 字段冒认。':'门窗位置与尺寸仍为设计或临时拟合；非实测复原',part:p.part,instanceId:a.instanceId,frame,floorId:a.floorId??null,sourceRef:'r07/apertures.mjs: deriveAperture',bounds:p.bounds});}
 for(const [k,s]of model.interfaces.stairs.entries())push({objectId:30000+k,id:s.id+':rail',nodeId:s.id,ownerId:s.id,buildingId:model.sourceModelId??measured.sourceModelId,classKey:'stair',geometryEvidence:'design 自有中心线扶手',classEvidence:'design 楼梯附属',evidence:'原渲染器将整套扶手写入一个 hit ID；单根子件不能从当前 hit ID 单独区分',frame,floorId:s.fromFloorId,sourceRef:'whole-building-ground-r01/rails.mjs'});
 records.sort((a,b)=>a.objectId-b.objectId);return records;
}
export function packRegistry(records){const width=Math.max(1,records.length),data=new Float32Array(width*4);records.forEach((r,i)=>{const c=r.color.slice(1).match(/../g).map(x=>parseInt(x,16)/255);data.set([r.objectId,...c],i*4);});return{width,height:1,data};}
export const SEMANTIC_SHADE=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D uHit,uSemantic;uniform int uSemanticCount;out vec4 outColor;
void main(){vec4 h=texelFetch(uHit,ivec2(gl_FragCoord.xy),0);if(h.w<.5){outColor=vec4(0.07,0.08,0.10,1.);return;}int lo=0,hi=uSemanticCount-1;vec3 c=vec3(1.,0.,1.);for(int k=0;k<20;k++){if(lo>hi)break;int m=(lo+hi)/2;vec4 r=texelFetch(uSemantic,ivec2(m,0),0);if(abs(r.x-h.y)<.1){c=r.yzw;break;}if(r.x<h.y)lo=m+1;else hi=m-1;}outColor=vec4(c,1.);}
`;
export const SEMANTIC_PRESENT=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D uColor;uniform vec2 uPresentResolution;out vec4 outColor;
void main(){ivec2 s=textureSize(uColor,0);ivec2 p=min(s-1,ivec2(gl_FragCoord.xy/uPresentResolution*vec2(s)));outColor=texelFetch(uColor,p,0);}
`;
