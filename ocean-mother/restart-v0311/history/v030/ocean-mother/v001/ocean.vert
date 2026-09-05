#version 300 es
precision highp float;
layout(location=0)in vec2 grid;
uniform vec4 uWaveK[24],uWaveA[24];uniform float tSea,chop,aspect,tanFov,eyeHeight,gridRows;
uniform vec3 camera,fw,right,up,flatForward;
out vec3 wPos,nBase;out float compression,crest;
void main(){float d=.45*(exp(grid.y*11.10)-1.);vec3 center=camera+flatForward*d;vec2 xz=center.xz+right.xz*(grid.x*2.-1.)*(max(16.,d*tanFov*aspect*1.35));vec3 p=vec3(xz.x,0.,xz.y),dx=vec3(1,0,0),dz=vec3(0,0,1);float rowSpan=max(.06,(d+.45)*11.10/gridRows),c=0.;
for(int k=0;k<24;k++){vec4 K=uWaveK[k],A=uWaveA[k];vec2 D=K.xy;float fade=1.-smoothstep(A.w*.25,A.w*.75,rowSpan);float phase=dot(D,xz)*K.z-K.w*tSea+A.z,s=sin(phase),co=cos(phase),amp=A.x*fade,q=A.y*chop*fade;
p+=vec3(D.x*q*co,amp*s,D.y*q*co);float aa=amp*K.z*co,qq=q*K.z*s;dx+=vec3(-D.x*D.x*qq,D.x*aa,-D.x*D.y*qq);dz+=vec3(-D.x*D.y*qq,D.y*aa,-D.y*D.y*qq);c+=amp*s;}
wPos=p;nBase=normalize(cross(dz,dx));compression=dx.x*dz.z-dx.z*dz.x;crest=c;
vec3 v=p-camera;float z=dot(v,fw),near=.15,far=60000.;gl_Position=vec4(dot(v,right)/(tanFov*aspect),dot(v,up)/tanFov,(far+near)/(far-near)*z-2.*far*near/(far-near),z);}
