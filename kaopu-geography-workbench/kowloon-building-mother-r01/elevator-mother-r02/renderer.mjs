import {MOTHER_GLSL,MATERIAL_GLSL,MOTHER_SHA256} from '../r07/material.mjs';
import {MASTER_METAL_GLSL,FINISH_GLSL} from './door-material.mjs';
import {sceneFields} from './geometry.mjs';
import {rayHit,scalePoint} from './controls.mjs';
const VS=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uResolution;uniform vec3 uEye,uTarget;uniform float uScale,uCarY,uInterior;
uniform int uCount;uniform vec4 uCenters[256],uHalves[256];
struct FieldHit {vec3 local;float materialRole;};
${MOTHER_GLSL}
${MATERIAL_GLSL}
${MASTER_METAL_GLSL}
${FINISH_GLSL}
float visibility(vec3 origin,vec3 ray,int omit){
 for(int j=0;j<256;j++){if(j>=uCount)break;if(j==omit)continue;vec3 inv=1./(ray+vec3(1e-8)),a=(uCenters[j].xyz-uHalves[j].xyz-origin)*inv,b=(uCenters[j].xyz+uHalves[j].xyz-origin)*inv;vec3 mn=min(a,b),mx=max(a,b);float near=max(mn.x,max(mn.y,mn.z)),far=min(mx.x,min(mx.y,mx.z));if(far>max(near,.001)&&near>0.)return .16;}return 1.;
}
void main(){
 vec3 fw=normalize(uTarget-uEye),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);
 vec2 q=(gl_FragCoord.xy/uResolution-.5)*vec2(uResolution.x/uResolution.y,1.);
 q.y-=.07;
 vec3 ro=uEye+rt*q.x*uScale+up*q.y*uScale,rd=fw;float best=1e5;int found=-1;vec3 normal=vec3(0);
 for(int i=0;i<256;i++){if(i>=uCount)break;vec3 c=uCenters[i].xyz,b=uHalves[i].xyz;
  vec3 inv=1./(rd+vec3(1e-8)),a=(c-b-ro)*inv,z=(c+b-ro)*inv,mn=min(a,z),mx=max(a,z);float near=max(mn.x,max(mn.y,mn.z)),far=min(mx.x,min(mx.y,mx.z));
  if(far>=max(near,0.)&&near<best&&near>0.){float t=near;bool hit=true;vec3 nn=near==mn.x?vec3(-sign(rd.x),0,0):near==mn.y?vec3(0,-sign(rd.y),0):vec3(0,0,-sign(rd.z));if(uCenters[i].w>3.5){float radius=min(.002,min(b.x,min(b.y,b.z))*.4);hit=false;for(int j=0;j<48;j++){vec3 q=abs(ro+rd*t-c)-b+radius;float d=length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-radius;if(d<.000008){hit=true;vec3 local=ro+rd*t-c;nn=normalize(sign(local)*max(abs(local)-b+radius,vec3(.00000001)));break;}t+=max(d,.000008);if(t>far)break;}}if(hit&&t<best){best=t;found=i;normal=nn;}}
 }
 vec3 col=mix(vec3(.025,.043,.06),vec3(.09,.13,.15),gl_FragCoord.y/uResolution.y);
 if(found>=0){vec3 p=ro+rd*best,local=p-uCenters[found].xyz;FieldHit hit=FieldHit(local,uCenters[found].w);FieldSurface s=sampleFieldMaterial(hit,normal,uScale/uResolution.y);float tone=uHalves[found].w;
  if(tone>0.5){s.baseColor=tone<1.5?vec3(.12,.39,.41):tone<2.5?vec3(.57,.39,.19):tone<3.5?vec3(.15,.18,.2):vec3(.95,.88,.68);s.metallic=tone<3.5?.72:0.;s.roughness=.28;}
  vec3 v=-rd,key=normalize(vec3(-3,7,5));float vis=visibility(p+normal*.002,key,found);vec3 reflected=reflect(-v,normal);vec3 environment=mix(vec3(.07,.1,.15),vec3(.6,.7,.8),smoothstep(-.3,.8,reflected.y));vec3 F=fresnelSchlick(max(dot(normal,v),0.),mix(vec3(.04),s.baseColor,s.metallic));col=s.baseColor*.2+environment*F*.65+directBRDF(s,normal,v,key,vec3(4.,3.7,3.1))*vis+directBRDF(s,normal,v,normalize(vec3(5,2,2)),vec3(.6,.9,1.1));if(tone>1.5&&tone<2.5){vec3 lamp=vec3(0,uCarY+2.32,-.15)-p;col+=directBRDF(s,normal,v,normalize(lamp),vec3(2.5,2.1,1.5)/(1.+dot(lamp,lamp)));}if(tone>3.5)col+=vec3(.65,.55,.35);
  if(tone>.5&&tone<3.5||tone>4.5){bool paint=tone>4.5||(tone<1.5&&uDoorFinish>.5)||(tone>1.5&&tone<2.5&&uInterior>.5);col=shadeLiftFinish(p,local,normal,v,uScale/uResolution.y/max(abs(dot(normal,v)),.15),paint,found);}
  if(tone>5.5)col=tone>6.5?vec3(.18,.85,.64):vec3(.009,.018,.023);
  col=col/(1.+col);col=pow(col,vec3(1./2.2));
 }
 fragColor=vec4(col,1.);
}`;
const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export class ElevatorRenderer{
 constructor(canvas){this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('此浏览器未提供 WebGL2');const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const p=this.p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));this.vao=gl.createVertexArray();this.angle=.65;this.close=false;this.finish=0;this.lightShift=0;this.detail=false;this.interior=false;this.panelView=null;this.stats={frames:0,modelTriangles:0,materialSource:MOTHER_SHA256};}
 project(point){const {eye,rt,up,scale,w,h}=this.camera,v=point.map((x,i)=>x-eye[i]);return [(0.5+dot(v,rt)/scale/(w/h))*w,(.43-dot(v,up)/scale)*h];}
 ray(x,y){const {eye,rt,up,fw,scale,w,h}=this.camera,qx=(x/w-.5)*w/h,qy=.43-y/h;return {origin:eye.map((v,i)=>v+rt[i]*qx*scale+up[i]*qy*scale),direction:fw};}
 pick(x,y){const r=this.ray(x,y);return rayHit(this.fields,r.origin,r.direction);}
 render(s){const g=this.gl,c=this.canvas;const key=JSON.stringify([s.y,s.v,s.current,s.carDoor,s.landingDoors,s.queue,s.target,s.state,s.floors,s.design,this.angle,this.close,this.detail,this.interior,this.panelView,this.finish,this.lightShift,c.clientWidth,c.clientHeight]);if(key===this.lastDraw)return;this.lastDraw=key;const dpr=Math.min(Math.max(devicePixelRatio||1,1.5),2),w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}g.viewport(0,0,w,h);g.useProgram(this.p);g.bindVertexArray(this.vao);const L=n=>g.getUniformLocation(this.p,n);let fields=sceneFields(s);if(this.interior)fields=fields.filter(f=>f.id.startsWith('car-')&&!f.id.startsWith('car-door'));this.fields=fields;if(fields.length>256)throw Error('字段上限');const centers=new Float32Array(256*4),halves=new Float32Array(256*4);fields.forEach((f,i)=>{centers.set([...f.center,f.role],i*4);halves.set([...f.half,f.tone],i*4);});g.uniform4fv(L('uCenters'),centers);g.uniform4fv(L('uHalves'),halves);g.uniform1i(L('uCount'),fields.length);
 const lo=s.floors[0].elevation,hi=s.floors.at(-1).elevation+2.6,mid=this.close?s.y+1.2:(lo+hi)/2;let scale=this.interior?Math.max(2.9,3.3*h/w):this.close?(this.detail?3.65:4.5):Math.max((hi-lo)*1.3,7.8*h/w);let target=this.interior?[0,s.y+1.2,-.9]:[0,mid,.3],eye=this.interior?[0,s.y+1.35,.60]:[Math.sin(this.angle)*26,mid+7,Math.cos(this.angle)*26];if(this.panelView){const car=this.panelView==='car',y=car?s.y:s.floors.find(f=>f.id===s.current).elevation,x=(car?.9:1.15)*s.design.width/2.56;target=[x,y+1.23,car?-.85:1.19];eye=[x,y+1.28,car?.60:5];scale=car?2.0:1.20;}const fw=norm(target.map((v,i)=>v-eye[i])),rt=norm(cross(fw,[0,1,0])),up=cross(rt,fw);this.camera={eye,rt,up,fw,scale,w:c.clientWidth,h:c.clientHeight};
 const labels=document.getElementById('floorLabels');if(labels){labels.replaceChildren();const label=(text,point,color)=>{const [x,y]=this.project(point);if(x<15||x>c.clientWidth-15||y<55||y>c.clientHeight-80)return;const el=document.createElement('span');el.textContent=text;el.style.left=x+'px';el.style.top=y+'px';if(color)el.style.color=color;labels.append(el);};
 if(!this.interior){for(const f of s.floors)label(f.label+' / '+f.elevation.toFixed(1)+' m',scalePoint(s,[-2.25,f.elevation+.3,1.3]));label('轿厢 / '+s.y.toFixed(2)+' m',scalePoint(s,[1.7,s.y+1.2,.1]),'#ebc07f');if(this.close&&!s.motion)label('层门 · 前排',scalePoint(s,[-.65,s.y+.5,.93]),'#91d9cd');}
 for(const f of fields.filter(f=>f.label)){const p=[f.center[0],f.center[1],f.center[2]+f.half[2]+.0001],[x,y]=this.project(p),hit=this.pick(x,y),px=2*f.half[0]/scale*c.clientHeight;if(hit?.id!==f.id||px<12||x<0||x>c.clientWidth||y<50||y>c.clientHeight-75)continue;const el=document.createElement('span');el.className='physical-label';el.dataset.part=f.id;el.textContent=f.label;el.style.left=x+'px';el.style.top=y+'px';el.style.width=px+'px';el.style.fontSize=Math.max(9,Math.min(24,2*f.half[1]/scale*c.clientHeight*.58))+'px';el.style.color=f.action?'#e4fff7':'#83efc6';el.style.transform=`translate(-50%,-50%) matrix(${rt[0]},${-up[0]},${-rt[1]},${up[1]},0,0)`;labels.append(el);}
 }
 g.uniform3fv(L('uEye'),eye);g.uniform3fv(L('uTarget'),target);g.uniform2f(L('uResolution'),w,h);g.uniform1f(L('uScale'),scale);g.uniform1f(L('uCarY'),s.y);g.uniform1f(L('uDoorFinish'),this.finish);g.uniform1f(L('uLightShift'),this.lightShift);g.uniform1f(L('uInterior'),s.design.interior);g.uniform1f(L('uFinishAge'),s.design.ageYears/40*.45);g.uniform1f(L('uAge'),s.design.ageYears/40*.45);g.uniform1f(L('uWet'),.01);g.uniform1f(L('uMaterialEnabled'),1);g.uniform3fv(L('uFrameColor'),[.38,.43,.45]);g.uniform3fv(L('uDoorColor'),[.5,.34,.15]);g.uniform3fv(L('uGlassColor'),[.8,.94,.94]);g.uniform1f(L('uFrameRoughness'),.26);g.uniform1f(L('uFrameMetallic'),.8);g.drawArrays(g.TRIANGLES,0,3);this.stats.frames++;this.stats.fieldCount=fields.length;}
}
