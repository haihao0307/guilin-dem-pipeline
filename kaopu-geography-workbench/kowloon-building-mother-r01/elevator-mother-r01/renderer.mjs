import {MOTHER_GLSL,MATERIAL_GLSL,MOTHER_SHA256} from '../r07/material.mjs';
import {sceneFields} from './geometry.mjs';
const VS=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FS=`#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uResolution;uniform vec3 uEye,uTarget;uniform float uScale,uCarY;
uniform int uCount;uniform vec4 uCenters[128],uHalves[128];
struct FieldHit {vec3 local;float materialRole;};
${MOTHER_GLSL}
${MATERIAL_GLSL}
float visibility(vec3 origin,vec3 ray,int omit){
 for(int j=0;j<128;j++){if(j>=uCount)break;if(j==omit)continue;vec3 inv=1./(ray+vec3(1e-8)),a=(uCenters[j].xyz-uHalves[j].xyz-origin)*inv,b=(uCenters[j].xyz+uHalves[j].xyz-origin)*inv;vec3 mn=min(a,b),mx=max(a,b);float near=max(mn.x,max(mn.y,mn.z)),far=min(mx.x,min(mx.y,mx.z));if(far>max(near,.001)&&near>0.)return .16;}return 1.;
}
void main(){
 vec3 fw=normalize(uTarget-uEye),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);
 vec2 q=(gl_FragCoord.xy/uResolution-.5)*vec2(uResolution.x/uResolution.y,1.);
 vec3 ro=uEye+rt*q.x*uScale+up*q.y*uScale,rd=fw;float best=1e5;int found=-1;vec3 normal=vec3(0);
 for(int i=0;i<128;i++){if(i>=uCount)break;vec3 c=uCenters[i].xyz,b=uHalves[i].xyz;
  vec3 inv=1./(rd+vec3(1e-8)),a=(c-b-ro)*inv,z=(c+b-ro)*inv,mn=min(a,z),mx=max(a,z);float near=max(mn.x,max(mn.y,mn.z)),far=min(mx.x,min(mx.y,mx.z));
  if(far>=max(near,0.)&&near<best&&near>0.){best=near;found=i;normal=near==mn.x?vec3(-sign(rd.x),0,0):near==mn.y?vec3(0,-sign(rd.y),0):vec3(0,0,-sign(rd.z));}
 }
 vec3 col=mix(vec3(.025,.043,.06),vec3(.09,.13,.15),gl_FragCoord.y/uResolution.y);
 if(found>=0){vec3 p=ro+rd*best,local=p-uCenters[found].xyz;FieldHit hit=FieldHit(local,uCenters[found].w);FieldSurface s=sampleFieldMaterial(hit,normal,uScale/uResolution.y);float tone=uHalves[found].w;
  if(tone>0.5){s.baseColor=tone<1.5?vec3(.12,.39,.41):tone<2.5?vec3(.57,.39,.19):tone<3.5?vec3(.15,.18,.2):vec3(.95,.88,.68);s.metallic=tone<3.5?.72:0.;s.roughness=.28;}
  vec3 v=-rd,key=normalize(vec3(-3,7,5));float vis=visibility(p+normal*.002,key,found);vec3 reflected=reflect(-v,normal);vec3 environment=mix(vec3(.07,.1,.15),vec3(.6,.7,.8),smoothstep(-.3,.8,reflected.y));vec3 F=fresnelSchlick(max(dot(normal,v),0.),mix(vec3(.04),s.baseColor,s.metallic));col=s.baseColor*.2+environment*F*.65+directBRDF(s,normal,v,key,vec3(4.,3.7,3.1))*vis+directBRDF(s,normal,v,normalize(vec3(5,2,2)),vec3(.6,.9,1.1));if(tone>1.5&&tone<2.5){vec3 lamp=vec3(0,uCarY+2.32,-.15)-p;col+=directBRDF(s,normal,v,normalize(lamp),vec3(2.5,2.1,1.5)/(1.+dot(lamp,lamp)));}if(tone>3.5)col+=vec3(.65,.55,.35);
  col=col/(1.+col);col=pow(col,vec3(1./2.2));
 }
 fragColor=vec4(col,1.);
}`;
export class ElevatorRenderer{
 constructor(canvas){this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('此浏览器未提供 WebGL2');const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};const p=this.p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,VS));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));this.vao=gl.createVertexArray();this.angle=.48;this.close=false;this.stats={frames:0,modelTriangles:0,materialSource:MOTHER_SHA256};}
 render(s){const g=this.gl,c=this.canvas;const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}g.viewport(0,0,w,h);g.useProgram(this.p);g.bindVertexArray(this.vao);const L=n=>g.getUniformLocation(this.p,n),fields=sceneFields(s);if(fields.length>128)throw Error('字段上限');const centers=new Float32Array(128*4),halves=new Float32Array(128*4);fields.forEach((f,i)=>{centers.set([...f.center,f.role],i*4);halves.set([...f.half,f.tone],i*4);});g.uniform4fv(L('uCenters'),centers);g.uniform4fv(L('uHalves'),halves);g.uniform1i(L('uCount'),fields.length);
 const lo=s.floors[0].elevation,hi=s.floors.at(-1).elevation+2.6,mid=this.close?s.y+1.2:(lo+hi)/2,scale=this.close?5.5:Math.max((hi-lo)*1.15,7.8*h/w);const target=[0,mid,.3],eye=[Math.sin(this.angle)*26,mid+7,Math.cos(this.angle)*26];const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);const fw=norm(target.map((v,i)=>v-eye[i])),rt=norm(cross(fw,[0,1,0])),up=cross(rt,fw),labels=document.getElementById('floorLabels');if(labels){labels.replaceChildren(...s.floors.map(f=>{const p=[-2.25,f.elevation+.3,1.3],v=p.map((x,i)=>x-eye[i]),x=(.5+dot(v,rt)/scale/(w/h))*c.clientWidth,y=(.5-dot(v,up)/scale)*c.clientHeight,el=document.createElement('span');el.textContent=f.label+' / '+f.elevation.toFixed(1)+' m';el.style.left=x+'px';el.style.top=y+'px';el.hidden=y<60||y>c.clientHeight-90;return el;}));const cp=[1.7,s.y+1.2,.1],cv=cp.map((x,i)=>x-eye[i]),marker=document.createElement('span');marker.textContent='轿厢 / '+s.y.toFixed(2)+' m';marker.style.color='#ebc07f';marker.style.transform='translate(0,-50%)';marker.style.left=((.5+dot(cv,rt)/scale/(w/h))*c.clientWidth)+'px';marker.style.top=((.5-dot(cv,up)/scale)*c.clientHeight)+'px';labels.append(marker);}g.uniform3fv(L('uEye'),eye);g.uniform3fv(L('uTarget'),target);g.uniform2f(L('uResolution'),w,h);g.uniform1f(L('uScale'),scale);g.uniform1f(L('uCarY'),s.y);g.uniform1f(L('uAge'),.16);g.uniform1f(L('uWet'),.01);g.uniform1f(L('uMaterialEnabled'),1);g.uniform3fv(L('uFrameColor'),[.38,.43,.45]);g.uniform3fv(L('uDoorColor'),[.5,.34,.15]);g.uniform3fv(L('uGlassColor'),[.8,.94,.94]);g.uniform1f(L('uFrameRoughness'),.26);g.uniform1f(L('uFrameMetallic'),.8);g.drawArrays(g.TRIANGLES,0,3);this.stats.frames++;this.stats.fieldCount=fields.length;}
}
