export const movingPositionFragment=`precision highp float;
uniform sampler2D rootMap,traitMap,guideMotion;
uniform float frizz,wave;
vec3 guideAt(int g,float t){float n=clamp(t,0.,1.)*24.;int a=int(floor(n)),b=min(24,a+1);return mix(texelFetch(guideMotion,ivec2(g,a),0).xyz,texelFetch(guideMotion,ivec2(g,b),0).xyz,fract(n));}
vec3 displacement(vec2 root,float t){vec2 v=clamp(vec2((root.x+.031)/.062*16.,(root.y+.006)/.012*4.),vec2(0.),vec2(16.,4.));ivec2 a=min(ivec2(floor(v)),ivec2(15,3));vec2 f=v-vec2(a);int g=a.y*17+a.x;return mix(mix(guideAt(g,t),guideAt(g+1,t),f.x),mix(guideAt(g+17,t),guideAt(g+18,t),f.x),f.y);}
void main(){
 int id=int(gl_FragCoord.x)+int(gl_FragCoord.y)*1024,root=id/81,node=id%81;if(root>=10000){gl_FragColor=vec4(0.);return;}
 ivec2 at=ivec2(root%128,root/128);vec4 rd=texelFetch(rootMap,at,0),tr=texelFetch(traitMap,at,0);
 float t=float(node)/80.,s=t*tr.x,phase=rd.z*.83,envelope=sin(3.14159265*s),clump=sin(3.14159265*t);clump*=clump;
 vec3 p=vec3(rd.x*(1.-.20*t*t)+wave*.012*sin(6.*s)*envelope,.128-.259*s,rd.y*(1.-.18*t)+wave*.012*sin(7.2*s+.4)*envelope);
  // R02 supplies correlated clumping and fine-strand variation, without pile.
  p.x+=.0013*sin(8.*s+phase)*clump;p.z+=.0024*sin(5.7*s+phase)*clump;
  float fine=(.00008+frizz*.0005)*(1.+tr.w*5.);
  p.x+=fine*(sin(19.*s+tr.z)-sin(tr.z))*smoothstep(0.,.1,t);
  p.z+=fine*(cos(23.*s+tr.z)-cos(tr.z))*smoothstep(0.,.1,t);
  p.x+=tr.w*frizz*.012*sin(4.6*t+tr.z)*t;
  p.z+=tr.w*frizz*.010*sin(5.2*t+tr.z)*t;
  p+=displacement(rd.xy,s);
 gl_FragColor=vec4(p,1.);
}`;
