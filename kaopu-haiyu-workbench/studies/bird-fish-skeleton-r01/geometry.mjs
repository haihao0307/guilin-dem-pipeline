// Two authored topology studies from visible video structure, not recovered artist code or anatomy.
import {add,sub,mul,dot,cross,transportedFrames} from './frame-core.mjs';
import {rotate} from './curve-math.mjs';
const PI=Math.PI,bounded=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,u)=>add(mul(a,1-u),mul(b,u));
const sample=(f,n=24)=>Array.from({length:n+1},(_,i)=>f(i/n));
const bezier=(a,b,c,d,u)=>add(add(mul(a,(1-u)**3),mul(b,3*(1-u)**2*u)),add(mul(c,3*(1-u)*u*u),mul(d,u**3)));
const world=(frame,offset)=>add(mul(frame.T,offset[0]),add(mul(frame.N,offset[1]),mul(frame.B,offset[2])));
function makeAxis(fn,n=160){const points=sample(fn,n),tangents=points.map((p,i)=>sub(points[Math.min(n,i+1)],points[Math.max(0,i-1)]));return {points,frames:transportedFrames(tangents)}}
function builder(kind,parameters,axis){
 const lines=[],joints=[],attachments=[];
 const port=(s)=>{const index=Math.round(bounded(s,0,1)*(axis.points.length-1));return {index,s:index/(axis.points.length-1),root:axis.points[index],frame:axis.frames[index]}};
 const line=(id,group,points,width=1,extra={})=>{const q={id,group,points,width,...extra};lines.push(q);return q};
 const attached=(id,group,points,source,width=1,extra={})=>{attachments.push({id,source:source.lineId||source.id||('axis@'+source.index),sourceLine:source.lineId||null,sourceVertex:source.pointIndex??0,sourceJoint:source.lineId||source.index!==undefined?null:source.id,sourceAxisIndex:source.index??null,root:[...source.root],point:[...points[0]]});return line(id,group,points,width,extra)};
 const joint=(id,root,radius=.016)=>{joints.push({id,point:root,radius});return {id,root}};
 return {lines,joints,attachments,port,line,attached,joint,finish(extra){return {schema:'haiyu.video-structure-study/1',kind,parameters,axis:axis.points,frames:axis.frames,lines,joints,attachments,...extra,semantics:'Authored structural interpretation; no recovered topology, surface, or physical simulation'}}};
}
function localArc(span,depth,wrap,u,side,sweep=0){const a=wrap*u;return[sweep*u,side*span*Math.sin(a),-depth*(1-Math.cos(a))]}
function segmentMarkers(b,addresses,scale,group){for(let j=0;j<addresses.length;j++){const p=b.port(addresses[j]);for(const side of[-1,1]){const q=sample(u=>add(p.root,world(p.frame,[-.014*u,side*scale*u,scale*.7*Math.sin(PI*u)])),8);b.attached(`${group}-${j}-${side}`,group,q,p,.8)}}}
export function evaluateBird(options={}){
 const p={time:0,amplitude:1,span:1,chest:1,...options};for(const k of Object.keys(options))if(!['time','amplitude','span','chest'].includes(k))throw Error('Unsupported bird parameter '+k);
 if(![p.time,p.amplitude,p.span,p.chest].every(Number.isFinite)||p.amplitude<0||p.amplitude>1.4||p.span<.75||p.span>1.2||p.chest<.8||p.chest>1.2)throw Error('Invalid bird parameters');
 const phase=2*PI*p.time/10.5,flap=p.amplitude*(.22+.47*Math.sin(phase-2.1));
 const ax=makeAxis(s=>{const x=-1.3+2.15*s,neck=bounded((.41-s)/.41,0,1);return[x,.012*p.amplitude*Math.sin(phase-2*s)*(1-neck),.14+.18*neck+.025*Math.sin(PI*s)+.018*p.amplitude*Math.sin(phase-.7)*Math.sin(PI*s)]});
 const b=builder('bird',p,ax);b.line('spine','axis',ax.points,2.8);
 segmentMarkers(b,Array.from({length:11},(_,j)=>.015+.36*j/10),.027,'front-chain');
 segmentMarkers(b,Array.from({length:6},(_,j)=>.87+.12*j/5),.035,'rear-chain');
 for(let j=0;j<18;j++){const a=.415+.42*j/17,port=b.port(a),q=j/17,profile=Math.sin(PI*(.025+.95*q))**.85,span=(.025+.23*profile)*p.chest,depth=(.025+.24*profile)*p.chest;
  for(const side of[-1,1]){const points=sample(u=>add(port.root,world(port.frame,localArc(span,depth,2.86,u,side,.055*Math.sin(PI*q)))),28);b.attached(`chest-${j}-${side}`,'chest',points,port,1.2,{side,station:j})}
 }
 // Paired wings have shoulder, elbow, wrist and distal beam. They are not copies of chest ribs.
 const shoulder=b.port(.45),wingJointIds=[];
 for(const side of[-1,1]){
  const toWorld=v=>add(shoulder.root,world(shoulder.frame,v));const rootLocal=[-.015,side*.13,.025],root=toWorld(rootLocal),rootJ=b.joint(`shoulder-${side}`,root,.024);
  b.attached(`shoulder-bridge-${side}`,'girdle',[shoulder.root,root],shoulder,2.2,{side});
  const rest=[[0,0,0],[.11,side*.49*p.span,.035],[.14,side*.54*p.span,.02],[.28,side*.64*p.span,.025]],angles=[flap,flap-.085*p.amplitude*Math.sin(phase-.25),flap-.15*p.amplitude*Math.sin(phase-.65)];
  const localJ=[rootLocal];for(let i=1;i<4;i++)localJ.push(add(localJ[i-1],rotate(rest[i],[side*angles[i-1],0,0])));
  const jointNames=['shoulder','elbow','wrist','wingtip'],worldJ=localJ.map(toWorld);
  for(let i=1;i<4;i++){b.joint(`${jointNames[i]}-${side}`,worldJ[i],i===3?.009:.018);b.attached(`wing-beam-${side}-${i}`,'wing-beam',[worldJ[i-1],worldJ[i]],{id:`${jointNames[i-1]}-${side}`,root:worldJ[i-1]},i===1?3:2.3,{side,boneLength:Math.hypot(...rest[i])})}
  const leading=[],trailing=[];
  for(let j=0;j<=20;j++){const v=j/20,z=v*3,segment=Math.min(2,Math.floor(z)),u=j===20?1:z-segment,rootLocalAt=lerp(localJ[segment],localJ[segment+1],u),rootAt=toWorld(rootLocalAt),angle=angles[segment],chord=(.05+.37*Math.sin(PI*v)**.85)*(1-.28*v),thickness=.025*Math.sin(PI*v);
   leading.push(rootAt);const rib=sample(t=>{const offset=rotate([chord*(1-Math.cos(2*PI*t))/2,0,-thickness*Math.sin(2*PI*t)],[side*angle,0,0]);return toWorld(add(rootLocalAt,offset))},20);
   b.attached(`wing-rib-${side}-${j}`,'wing-ribs',rib,{lineId:`wing-leading-${side}`,pointIndex:j,root:rootAt},.85,{side,spanAddress:v});trailing.push(toWorld(add(rootLocalAt,rotate([chord,0,0],[side*angle,0,0]))));
  }
  b.line(`wing-leading-${side}`,'wing-beam',leading,1.2,{side});b.line(`wing-trailing-${side}`,'wing-ribs',trailing,.85,{side});wingJointIds.push(...jointNames.map(x=>x+'-'+side));
 }
 // Two suspended segmented appendages. No invented toes, feet or ground-contact gait.
 const hip=b.port(.82);
 for(const side of[-1,1]){const r=add(hip.root,world(hip.frame,[0,side*.13,-.04]));b.attached(`hip-bridge-${side}`,'girdle',[hip.root,r],hip,2.1,{side});b.joint(`hip-${side}`,r,.024);const swing=.018*p.amplitude*Math.sin(phase-.4);const bends=[[.01,side*.015,-.46],[.25,side*.02,-.35],[.17,side*.006,-.26]];let prev=r;
  for(let k=0;k<bends.length;k++){const delta=rotate(bends[k],[0,swing,0]),q=add(prev,world(hip.frame,delta));b.attached(`leg-${side}-${k}`,'legs',[prev,q],{id:k?`leg-joint-${side}-${k-1}`:`hip-${side}`,root:prev},k===2?1.4:3,{side,boneLength:Math.hypot(...bends[k])});b.joint(`leg-joint-${side}-${k}`,q,k===2?.006:.017);prev=q}
 }
 return b.finish({duration:10.5,camera:{target:[-.12,0,-.18],extent:4.15,azimuth:-1.05,elevation:.23},sourceMotion:'Paired wing elevation is visible; period and articulated driver here are our approximate design',motion:{flapRadians:flap,wingJointIds},regions:['front-chain','chest','wing-beam','wing-ribs','legs','rear-chain'],unknown:['precise head form','artist topology','anatomical identity','force dynamics']});
}
export function evaluateFish(options={}){
 const p={time:0,amplitude:0,span:1,chest:1,...options};for(const k of Object.keys(options))if(!['time','amplitude','span','chest'].includes(k))throw Error('Unsupported fish parameter '+k);
 if(![p.time,p.amplitude,p.span,p.chest].every(Number.isFinite)||p.amplitude<0||p.amplitude>1.4||p.span<.75||p.span>1.2||p.chest<.8||p.chest>1.2)throw Error('Invalid fish parameters');
 const phase=2*PI*p.time/6;
 const ax=makeAxis(s=>[-1.55+2.7*s,.10*Math.sin(PI*s)+p.amplitude*.10*(1-s)**1.6*Math.sin(phase-4*s),-.30*Math.sin(PI*s)+.60*s*s]);
 const b=builder('fish',p,ax);b.line('spine','axis',ax.points,2.7);segmentMarkers(b,Array.from({length:38},(_,j)=>.015+.97*j/37),.025,'segment-chain');
 // A long narrow repeating section and a sharply broader chamber, not an equal-width chest array.
 for(let j=0;j<38;j++){const s=.025+.95*j/37,port=b.port(s),wide=Math.exp(-(((s-.75)/.135)**2)),width=(.075+.055*Math.sin(PI*s)+.33*wide)*p.chest,depth=(.064+.06*Math.sin(PI*s)+.28*wide)*p.chest;
  for(const side of[-1,1]){const points=sample(u=>add(port.root,world(port.frame,localArc(width,depth,3.02,u,side,.015+.025*wide))),26);b.attached(`segment-rib-${j}-${side}`,'segment-ribs',points,port,wide>.5?1.35:.9,{side,station:j,axisAddress:s,wideChamber:wide>.5})}
 }
 // Several wide-chamber supports, each with its own axial root: no avian elbow/wrist topology.
 for(const side of[-1,1])for(let j=0;j<4;j++){const s=.635+.047*j,port=b.port(s),height=(.34+.085*j)*p.span,spread=(.52+.08*j)*p.span;
  const points=sample(u=>{const offset=bezier([0,0,0],[-.22,side*spread*.85,height*.85],[.24,side*spread,height],[.40,side*spread*.43,height*.12],u);return add(port.root,world(port.frame,offset))},32);b.attached(`chamber-arch-${side}-${j}`,'chamber-arches',points,port,2.0,{side,axisAddress:s});
  // Sparse secondary struts show attachment hierarchy under the broad arch.
  for(let k=1;k<=4;k++){const u=k/5,root=points[Math.round(u*32)],end=add(port.root,world(port.frame,[.22+u*.1,side*(.17+.26*u),-.10-.17*u]));b.attached(`arch-strut-${side}-${j}-${k}`,'chamber-struts',sample(v=>bezier(root,add(root,[0,0,-.08]),lerp(root,end,.8),end,v),12),{lineId:`chamber-arch-${side}-${j}`,pointIndex:Math.round(u*32),root},.8,{side})}
 }
 // Dorsal fan-like supports visible around the wide zone, kept open and unskinned.
 for(let j=0;j<10;j++){const s=.59+.027*j,port=b.port(s),height=(.26+.53*Math.sin(PI*j/11))*p.span;const points=sample(u=>add(port.root,world(port.frame,[.20*Math.sin(PI*u),.035*Math.sin(PI*u)*(j%2?1:-1),height*Math.sin(PI*u*.70)])),22);b.attached(`crest-${j}`,'crest',points,port,1.4,{axisAddress:s})}
 return b.finish({duration:6,camera:{target:[-.04,0,.10],extent:3.65,azimuth:-1.05,elevation:.30},sourceMotion:'Changing video viewpoints do not establish a swimming driver; nonzero amplitude is explicitly our test motion',motion:{testMotionOnly:true},regions:['segment-chain','segment-ribs','chamber-arches','chamber-struts','crest'],unknown:['which terminal is anatomical head/tail','hidden connections','artist topology','reference swimming dynamics']});
}
export function evaluate(kind,options={}){if(kind==='bird')return evaluateBird(options);if(kind==='fish')return evaluateFish(options);throw Error('Unknown structure case')}
export function project(v,view,azimuth=-1.05,elevation=.23){if(view==='xy')return[v[0],-v[1],v[2]];if(view==='xz')return[v[0],-v[2],v[1]];if(view==='yz')return[v[1],-v[2],v[0]];const ca=Math.cos(azimuth),sa=Math.sin(azimuth),ce=Math.cos(elevation),se=Math.sin(elevation);return[-sa*v[0]+ca*v[1],se*ca*v[0]+se*sa*v[1]-ce*v[2],ce*ca*v[0]+ce*sa*v[1]+se*v[2]]}
export function inspect(p){let attachmentError=0,boneLengthError=0,orthogonality=0;for(const a of p.attachments){const parent=a.sourceAxisIndex!==null?p.axis[a.sourceAxisIndex]:a.sourceLine?p.lines.find(l=>l.id===a.sourceLine)?.points[a.sourceVertex]:p.joints.find(j=>j.id===a.sourceJoint)?.point;if(!parent)throw Error('Unresolved attachment '+a.id+' to '+a.source);attachmentError=Math.max(attachmentError,Math.hypot(...sub(a.point,parent)));}for(const l of p.lines)if(l.boneLength)boneLengthError=Math.max(boneLengthError,Math.abs(Math.hypot(...sub(l.points[1],l.points[0]))-l.boneLength));for(const f of p.frames)orthogonality=Math.max(orthogonality,Math.abs(dot(f.T,f.N)),Math.abs(dot(f.T,f.B)),Math.abs(dot(f.N,f.B)));return{allFinite:p.lines.every(l=>l.points.every(v=>v.every(Number.isFinite))),attachmentError,boneLengthError,orthogonality,lines:p.lines.length,points:p.lines.reduce((n,l)=>n+l.points.length,0),groups:[...new Set(p.lines.map(l=>l.group))]}}
