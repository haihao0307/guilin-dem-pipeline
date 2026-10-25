const c=document.getElementById('c');const gl=c.getContext('webgl2',{preserveDrawingBuffer:true});window.QA={compiled:[],errors:[],draws:0,done:false};
const vs=`#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;
function shader(type,s){let x=gl.createShader(type);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x}
const vec=a=>'vec3('+a.map(x=>Number(x).toFixed(8)).join(',')+')';
const programs={};
function scissorBox(lo,hi,eye,target){
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((r,v,i)=>r+v*b[i],0),norm=a=>a.map(v=>v/Math.hypot(...a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const f=norm(sub(target,eye)),r=norm(cross(f,[0,1,0])),u=cross(r,f),xs=[],ys=[];
 for(let i=0;i<8;i++){let p=sub([i&1?hi[0]:lo[0],i&2?hi[1]:lo[1],i&4?hi[2]:lo[2]],eye),z=dot(p,f);if(z<=0)return [0,0,720,400];xs.push(360+400/1.2*dot(p,r)/z);ys.push(200+400/1.2*dot(p,u)/z);}
 let x=Math.max(0,Math.floor(Math.min(...xs))-2),y=Math.max(0,Math.floor(Math.min(...ys))-2),xx=Math.min(720,Math.ceil(Math.max(...xs))+2),yy=Math.min(400,Math.ceil(Math.max(...ys))+2);return [x,y,Math.max(0,xx-x),Math.max(0,yy-y)];
}

(async()=>{try{
for(const [source,code] of Object.entries(SCENE.sources)){
let ps=SCENE.parts.filter(p=>p.source===source);
let dispatch=ps.map((p,i)=>`if(id==${i})return ${DYNAMIC.scalar(p)};`).join('\n');

let ranges=ps.map((p,i)=>p.interval_function?`if(id==${i}){${DYNAMIC.interval(p)}}`:'').join('\n');
let fs=`#version 300 es
precision highp float;precision highp int;
out vec4 outColor;uniform int id;uniform vec3 bmin,bmax,color;uniform float lip;uniform vec3 eye,target;uniform float cutX;
${DYNAMIC.glsl}
${code}
${source==='pressure'?SCENE.sources.service:''}
float field(vec3 p){${dispatch}return 1e20;}
vec2 ranges(vec3 lo,vec3 hi){${ranges}return vec2(-1e20,1e20);}
void main(){vec3 fw=normalize(target-eye),rt=normalize(cross(fw,vec3(0,1,0))),up=cross(rt,fw);vec2 uv=(gl_FragCoord.xy-vec2(360,200))/400.;vec3 rd=normalize(fw+rt*uv.x*1.2+up*uv.y*1.2);vec3 inv=1./rd;vec3 aa=(bmin-eye)*inv,bb=(bmax-eye)*inv;vec3 nearv=min(aa,bb),farv=max(aa,bb);float t=max(0.,max(nearv.x,max(nearv.y,nearv.z))),end=min(farv.x,min(farv.y,farv.z));if(t>end)discard;
float hit=-1.;
if(lip>0.){
for(int i=0;i<1600;i++){if(t>end)break;vec3 p=eye+rd*t;float f=field(p);if(p.x>cutX)f=max(f,p.x-cutX);
if(f<=0.0005){hit=t;break;}t+=max(f/lip,0.00025);}
}else{
float lefts[32];float rights[32];int top=1;lefts[0]=t;rights[0]=end;
for(int i=0;i<4096;i++){if(top==0)break;top--;float a=lefts[top],b=rights[top];vec3 pa=eye+rd*a,pb=eye+rd*b;if(min(pa.x,pb.x)>cutX)continue;vec2 rr=ranges(min(pa,pb),max(pa,pb));if(rr.x>0.)continue;
if(b-a<0.0005){float mid=(a+b)*.5;vec3 pm=eye+rd*mid;if(pm.x<=cutX&&field(pm)<=0.0005){hit=mid;break;}continue;}
float mid=(a+b)*.5;if(top<30){lefts[top]=mid;rights[top]=b;top++;lefts[top]=a;rights[top]=mid;top++;}}
}
if(hit<0.)discard;vec3 p=eye+rd*hit;float h=.0003;vec3 n=normalize(vec3(field(p+vec3(h,0,0))-field(p-vec3(h,0,0)),field(p+vec3(0,h,0))-field(p-vec3(0,h,0)),field(p+vec3(0,0,h))-field(p-vec3(0,0,h))));float light=.3+.7*abs(dot(n,normalize(vec3(.6,.9,.4))));outColor=vec4(color*light,1);gl_FragDepth=hit/80.;}`;
let p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs.replace(/\b[A-Za-z_]\w*__\w*\b/g,n=>n.replace(/__/g,"_neg_"))));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));programs[source]={p,ps};QA.compiled.push({source,parts:ps.length});document.getElementById("status").textContent=JSON.stringify(QA);await new Promise(r=>setTimeout(r,0));}
async function renderFrame(eye=[16,5,-4],target=[0,1.8,-4],cut=100,theta=.4,installation=DYNAMIC.snapshot()){QA.done=false;gl.enable(gl.DEPTH_TEST);gl.clearColor(.075,.1,.14,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);QA.draws=0;const start=performance.now();for(const [src,{p,ps}]of Object.entries(programs)){gl.useProgram(p);const u=n=>gl.getUniformLocation(p,n);gl.uniform3fv(u('eye'),eye);gl.uniform3fv(u('target'),target);gl.uniform1f(u('cutX'),cut);gl.uniform1f(u('timeTheta'),theta);gl.uniform1f(u('middleInclination'),installation.beta);gl.uniform1i(u('installationCandidate'),installation.mode==='candidate'?1:0);gl.uniform3fv(u('color'),src==='pressure'?[.38,.62,.72]:src==='motion'?[.85,.54,.25]:src==='service'?[.73,.57,.26]:[.56,.62,.65]);for(let i=0;i<ps.length;i++){let x=ps[i],bounds=DYNAMIC.bounds(x,theta,installation);let vm=DYNAMIC.valveFrame(x,theta,installation)?.inverseYZ||[1,0,0,0,1,0];gl.uniform3fv(u('valveInverseRow0'),vm.slice(0,3));gl.uniform3fv(u('valveInverseRow1'),vm.slice(3,6));gl.uniform1i(u('id'),i);gl.uniform3fv(u('bmin'),bounds[0]);gl.uniform3fv(u('bmax'),bounds[1]);gl.uniform1f(u('lip'),x.lipschitz||0);gl.enable(gl.SCISSOR_TEST);gl.scissor(...scissorBox(bounds[0],bounds[1],eye,target));gl.drawArrays(gl.TRIANGLES,0,3);QA.draws++;}await new Promise(r=>setTimeout(r,0));}gl.disable(gl.SCISSOR_TEST);gl.finish();QA.ms=performance.now()-start;QA.jsSubmissionMs=QA.ms;QA.glError=gl.getError();QA.theta=theta;QA.installation=installation;QA.mechanicalAcceptance=false;QA.outsideValves=installation.mode==='candidate'?{leftQ:DYNAMIC.outsideValvePose(theta).left.spindleDisplacement,rightQ:DYNAMIC.outsideValvePose(theta).right.spindleDisplacement,fixedReversingSetting:.75,reconstructed:true,middleFrozen:true}:null;QA.done=true;document.getElementById("status").textContent=`519 analytic fields · ${QA.draws} full-screen triangle draws · GL ${QA.glError} · JS submission ${(QA.jsSubmissionMs/1000).toFixed(2)} s; GPU readback timing only in BROWSER_QA · theta ${theta.toFixed(4)} rad`;if(window.RESEARCH_UI)RESEARCH_UI.showRendered(theta,installation);return {...QA};}
let renderTail=Promise.resolve();window.render=function(eye,target,cut,theta,installation=DYNAMIC.snapshot()){const snapshot=DYNAMIC.snapshot(installation);const next=renderTail.then(()=>renderFrame(eye,target,cut,theta,snapshot));renderTail=next.catch(()=>{});return next;};
window.RESEARCH_UI.install();await RESEARCH_UI.request();

}catch(e){QA.errors.push(String(e));document.getElementById("status").textContent=JSON.stringify(QA,null,2)}})();
