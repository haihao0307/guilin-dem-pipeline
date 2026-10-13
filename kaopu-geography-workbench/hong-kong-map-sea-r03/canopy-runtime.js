// Root-clamped multiscale bend adapted from the hair workbench's own anemone-core.
// A new geographic canopy test, not transferred head hair and not botanical trees.
const canopyVS=`#version 300 es
precision highp float;
layout(location=0) in vec3 root;layout(location=1) in vec4 shape;
uniform vec3 camera,fw,right,up;uniform float tanFov,aspect,windTime;out float h,edge,phase;out vec3 world;
float hash(float n){return fract(sin(n*127.1+73.)*43758.5453)*2.-1.;}
float noise(float x){float i=floor(x),f=fract(x),u=f*f*(3.-2.*f);return mix(hash(i),hash(i+1.),u);}
void main(){int k=gl_VertexID%18;int seg=k/6,corner=k%6;float u0=float(seg)/3.,u1=float(seg+1)/3.;float u=(corner==0||corner==1||corner==3)?u0:u1;float side=(corner==0||corner==3||corner==5)?-1.:1.;float a=shape.z+float(gl_VertexID/18)*1.57079633,t=windTime*.42,flex=u*u;
 float shared=sin(t*6.2831853*.55-u*1.5+root.x*.003)+.23*sin(t*6.2831853*.217+root.z*.005);
 float local=noise(t*1.9-u*.9+root.x*.07+root.z*.05);
 float flow=.55+shared*.6+(sin(t*6.2831853*.55)*.7+sin(t*6.2831853*.217+1.)*.3)*.15;
 vec2 bend=flex*shape.y*vec2(flow*.13-local*.04,flow*.06+local*.08);
 float width=shape.x*(1.-u*.82);world=root+vec3(cos(a)*side*width+bend.x,u*shape.y,sin(a)*side*width+bend.y);h=u;edge=side;phase=shape.w;
 vec3 v=world-camera;float z=dot(v,fw),near=.15,far=60000.;gl_Position=vec4(dot(v,right)/(tanFov*aspect),dot(v,up)/tanFov,(far+near)/(far-near)*z-2.*far*near/(far-near),z);
}`;
const canopyFS=`#version 300 es
precision highp float;in float h,edge,phase;in vec3 world;out vec4 O;void main(){float fringe=.86+.14*sin(h*43.+phase*23.);if(abs(edge)>fringe)discard;vec3 col=mix(vec3(.09,.22,.095),vec3(.31,.46,.19),h);col*=.82+.18*phase;O=vec4(col,1.);}`;
const canopyProgram=program(canopyVS,canopyFS),canopyRoots=[];
const canopyAreas=[{x:3331.595,z:3323.869,r:720},{x:8180,z:180,r:480},{x:-480,z:-11000,r:400}];
function canopyRand(n){return (Math.sin(n*127.1+73)*43758.5453)%1+.5}
for(let a of canopyAreas)for(let x=a.x-a.r;x<a.x+a.r;x+=5)for(let z=a.z-a.r;z<a.z+a.r;z+=5){let seed=x*.173+z*.117,j=(Math.sin(seed)*43758.5)%1,xx=x+j*6,zz=z+Math.sin(seed*3)*4,h=hkHeight(xx,zz);if(!Number.isFinite(h)||h<160||Math.hypot(xx-a.x,zz-a.z)>a.r)continue;let dx=hkHeight(xx+8,zz)-hkHeight(xx-8,zz),dz=hkHeight(xx,zz+8)-hkHeight(xx,zz-8);if(Math.hypot(dx,dz)>30)continue;canopyRoots.push(xx,h-.15,zz,1.8+Math.abs(j)*.6,4.5+Math.abs(j)*3,seed,Math.abs(j))}
const canopyVAO=gl.createVertexArray();gl.bindVertexArray(canopyVAO);const canopyVB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,canopyVB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(canopyRoots),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.vertexAttribDivisor(0,1);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12);gl.vertexAttribDivisor(1,1);
function drawCanopy(now,s,e,c){if(!mapState.canopy)return;common(canopyProgram,now,s,e,c);f(canopyProgram,'windTime',seaTime);gl.bindVertexArray(canopyVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,36,canopyRoots.length/7);qa.canopyRoots=canopyRoots.length/7;qa.canopyTime=seaTime}
