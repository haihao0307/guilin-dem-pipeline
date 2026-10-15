export const movingPositionFragment=`precision highp float;
uniform sampler2D rootMap,traitMap,guideMotion,guideFrames,clumpMap;
uniform float frizz,wave,silkiness,clumping,styleIndex,rootY;
vec3 nodeAt(sampler2D tex,int g,int n){return texelFetch(tex,ivec2(g,clamp(n,0,32)),0).xyz;}
vec3 curveAt(int g,float t){float v=pow(clamp(t,0.,1.),1./1.3)*32.;int i=min(31,int(floor(v)));float f=v-float(i);vec3 p0=nodeAt(guideMotion,g,i-1),p1=nodeAt(guideMotion,g,i),p2=nodeAt(guideMotion,g,i+1),p3=nodeAt(guideMotion,g,i+2);return .5*((2.*p1)+(-p0+p2)*f+(2.*p0-5.*p1+4.*p2-p3)*f*f+(-p0+3.*p1-3.*p2+p3)*f*f*f);}
void weights(vec2 root,out ivec4 ids,out vec4 w){vec2 v=clamp(vec2((root.x+.032)/.064*16.,(root.y+.017)/.034*4.),vec2(0.),vec2(16.,4.));ivec2 a=min(ivec2(floor(v)),ivec2(15,3));vec2 f=v-vec2(a);int g=a.y*17+a.x;ids=ivec4(g,g+1,g+17,g+18);w=vec4((1.-f.x)*(1.-f.y),f.x*(1.-f.y),(1.-f.x)*f.y,f.x*f.y);}
vec3 field(vec2 root,float t){ivec4 g;vec4 w;weights(root,g,w);return curveAt(g.x,t)*w.x+curveAt(g.y,t)*w.y+curveAt(g.z,t)*w.z+curveAt(g.w,t)*w.w;}
vec3 normalField(vec2 root,float t){ivec4 g;vec4 w;weights(root,g,w);int n=int(pow(clamp(t,0.,1.),1./1.3)*32.+.5);return nodeAt(guideFrames,g.x,n)*w.x+nodeAt(guideFrames,g.y,n)*w.y+nodeAt(guideFrames,g.z,n)*w.z+nodeAt(guideFrames,g.w,n)*w.w;}
void main(){
 int id=int(gl_FragCoord.x)+int(gl_FragCoord.y)*1024,root=id/81,node=id%81;if(root>=10000){gl_FragColor=vec4(0.);return;}
 ivec2 at=ivec2(root%128,root/128);vec4 rd=texelFetch(rootMap,at,0),tr=texelFetch(traitMap,at,0),cluster=texelFetch(clumpMap,ivec2(int(rd.z),0),0);
 float t=float(node)/80.,s=t*tr.x,gather=clumping*cluster.z*smoothstep(0.,.22,t)*(1.-.34*smoothstep(.70,1.,t));
 vec2 flowRoot=mix(rd.xy,cluster.xy,gather);vec3 center=field(flowRoot,s),start=field(flowRoot,0.),follicle=field(rd.xy,0.);vec3 p=center+(follicle-start)*(1.-smoothstep(0.,.30,t));
 vec3 T=normalize(field(flowRoot,min(1.,s+.003))-field(flowRoot,max(0.,s-.003))),N=normalField(flowRoot,s);N=normalize(N-T*dot(N,T));vec3 B=normalize(cross(T,N));
 float smoothFlow=smoothstep(0.,.12,t),loose=tr.w,phase=cluster.w,amplitude=mix(.00044,.000055,silkiness)*(1.+loose*5.)*(.5+.5*frizz/.3),subclump=.00022*(1.-gather)*smoothFlow;
 float radialN=amplitude*(sin(13.*s+phase+tr.z*.18)-sin(phase+tr.z*.18))*smoothFlow,radialB=amplitude*.70*(cos(11.*s+phase+tr.z*.18)-cos(phase+tr.z*.18))*smoothFlow;
 radialN+=subclump*sin(tr.z)*sin(3.14159265*t)+loose*.0015*sin(5.*t+tr.z)*t;
 radialB+=subclump*cos(tr.z)*sin(3.14159265*t)+loose*.0012*cos(4.*t+tr.z)*t;
 p+=N*radialN+B*radialB;gl_FragColor=vec4(p,1.);
}`;
