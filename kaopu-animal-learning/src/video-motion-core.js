// Local, manually constrained observation rig. No detector, learned pose model, or hidden-depth inference.
export const MOTION_SCHEMA='kaopu/animal-video-observation@1';
export const MOTION_JOINTS=[['croup','臀背轮廓'],['withers','鬐甲轮廓'],['poll','头顶轮廓'],['nose','鼻端'],['tail','尾端'],['fore_a_root','前肢 A 根部'],['fore_a_mid','前肢 A 中段'],['fore_a_tip','前肢 A 足端'],['fore_b_root','前肢 B 根部'],['fore_b_mid','前肢 B 中段'],['fore_b_tip','前肢 B 足端'],['hind_a_root','后肢 A 根部'],['hind_a_mid','后肢 A 中段'],['hind_a_tip','后肢 A 足端'],['hind_b_root','后肢 B 根部'],['hind_b_mid','后肢 B 中段'],['hind_b_tip','后肢 B 足端']];
export const MOTION_EDGES=[['croup','withers'],['withers','poll'],['poll','nose'],['croup','tail'],...['fore_a','fore_b','hind_a','hind_b'].flatMap(p=>[[p.startsWith('fore')?'withers':'croup',p+'_root'],[p+'_root',p+'_mid'],[p+'_mid',p+'_tip']])];
const motionIds=new Set(MOTION_JOINTS.map(j=>j[0]));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function validateMotion(doc){
 if(!doc||doc.schema!==MOTION_SCHEMA||doc.origin!=='manual_video_observation')throw Error('不是受支持的人工视频动作记录');
 const m=doc.media;if(!m||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.width*m.height>16777216||!finite(m.duration)||m.duration<=0||m.duration>3600)throw Error('视频尺寸或时长无效');
 if(typeof m.sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sha256))throw Error('记录缺少视频 SHA-256');
 if(!finite(doc.fps)||doc.fps<1||doc.fps>120||!finite(doc.groundY)||doc.groundY<0||doc.groundY>m.height)throw Error('帧率或地面无效');
 if(!['unresolved','a_left','a_right'].includes(doc.sideMapping))throw Error('左右映射无效');
 if(!Array.isArray(doc.frames)||doc.frames.length>600)throw Error('最多记录 600 个关键帧');
 let last=-1;for(const f of doc.frames){if(!finite(f.time)||f.time<0||f.time>=m.duration||f.time<=last)throw Error('关键帧时间必须严格递增且在视频范围内');last=f.time;
  if(!f.points||typeof f.points!=='object'||Array.isArray(f.points)||Object.keys(f.points).length>MOTION_JOINTS.length)throw Error('点位数据无效');
  for(const [id,p]of Object.entries(f.points)){if(!motionIds.has(id))throw Error('未知的骨架槽位');if(!p||!['visible','occluded','uncertain'].includes(p.visibility))throw Error('可见性无效');if(p.visibility!=='visible')continue;
   if(!finite(p.x)||!finite(p.y)||p.x<0||p.y<0||p.x>m.width||p.y>m.height)throw Error('点位超出原视频像素范围');
   for(const k of ['dx','dy','z'])if(!finite(p[k])||Math.abs(p[k])>m.width*2)throw Error('三维人工偏移无效');
   if(!['unknown','contact','air'].includes(p.contact)||typeof p.identityConfirmed!=='boolean')throw Error('接触或轨迹身份状态无效');
  }
 }
 return doc;
}
export function poseAt(doc,time){
 const fs=doc.frames;if(!fs.length)return {points:{},kind:'empty',time};
 const exact=fs.find(f=>Math.abs(f.time-time)<.0005);if(exact)return {points:structuredClone(exact.points),kind:'manual_keyframe',time:exact.time};
 const left=[...fs].reverse().find(f=>f.time<time),right=fs.find(f=>f.time>time);if(!left||!right)return {points:{},kind:'outside_observed_range',time};
 const a=(time-left.time)/(right.time-left.time),points={};
 for(const id of motionIds){const p=left.points[id],q=right.points[id];if(p?.visibility!=='visible'||q?.visibility!=='visible'||!p.identityConfirmed||!q.identityConfirmed)continue;points[id]={visibility:'visible',identityConfirmed:true,contact:'unknown',interpolated:true};for(const k of ['x','y','dx','dy','z'])points[id][k]=p[k]+(q[k]-p[k])*a;}
 return {points,kind:'linear_interpolation_not_observation',time,bracket:[left.time,right.time]};
}
export function rigAt(doc,time){const pose=poseAt(doc,time),points={};for(const[id,p]of Object.entries(pose.points))if(p.visibility==='visible')points[id]={x:(p.x+p.dx-doc.media.width/2)/doc.media.width,y:(doc.groundY-p.y-p.dy)/doc.media.width,z:p.z/doc.media.width,observedX:p.x,observedY:p.y,contact:p.contact,interpolated:!!p.interpolated};return {...pose,points};}
export function projectRigPoint(doc,p){return {x:p.x*doc.media.width+doc.media.width/2,y:doc.groundY-p.y*doc.media.width};}
export function motionMetrics(doc,time){const rig=rigAt(doc,time),errors=[],contact=[];for(const[id,p]of Object.entries(rig.points)){const q=projectRigPoint(doc,p),e=Math.hypot(q.x-p.observedX,q.y-p.observedY);errors.push(e);if(id.endsWith('_tip')&&p.contact==='contact')contact.push({id,distancePx:Math.abs(q.y-doc.groundY)});}return {count:errors.length,rmsPx:errors.length?Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/errors.length):null,maxPx:errors.length?Math.max(...errors):null,contact,meaning:'Reprojection residual to authored 2D points, not 3D accuracy. Zero follows direct back-projection without XY edits.',depthRecovered:false};}
export function motionExport(doc){validateMotion(doc);return {...structuredClone(doc),claims:{automaticPoseInference:false,depthRecovered:false,metricScaleKnown:false,originalAnimalModelBound:false},rig:{schema:'kaopu/observation-rig@1',axes:'X image-right; Y up; Z user-authored depth; 1 unit = image width',projection:'orthographic side view; no calibrated camera',joints:MOTION_JOINTS.map(([id,label])=>({id,label})),edges:MOTION_EDGES,adapter:null,frames:doc.frames.map(f=>({time:f.time,points:rigAt(doc,f.time).points,metrics:motionMetrics(doc,f.time)}))}};}
