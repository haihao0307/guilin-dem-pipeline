uniform sampler2D uYarnImage,uYarnDepth,uFibres;
uniform highp usampler2D uFibreOffsets,uFibreIndices;
uniform int uFibreTextureWidth,uIndexTextureWidth,uTilesX;
uniform bool uHullPrune;
uniform bool uStopAtExactStall;
vec4 fibreWord(uint at){return texelFetch(uFibres,ivec2(int(at)%uFibreTextureWidth,int(at)/uFibreTextureWidth),0);}
vec3 path(vec3 root,vec3 strand,vec3 bend,vec3 curl,float wave,float t){return root+strand*t+bend*t*t+curl*sin(wave*t)*sin(3.141592654*t);}
float segmentDistanceSquared(vec3 a,vec3 b){vec3 d=b-a;float t=clamp(-dot(a,d)/max(1.e-18,dot(d,d)),0.,1.);vec3 q=a+d*t;return dot(q,q);}
bool outsideFibreControlHull(vec3 ro,vec3 rd,vec3 root,vec3 strand,vec3 bend,vec3 curl,float radius){
 // The quadratic part stays inside its three control-point convex hull.
 // The exact trigonometric curl is bounded by length(curl). Rejecting the
 // expanded projected hull avoids Newton work; it does not replace the curve.
 vec3 qa=root-ro,qb=qa+strand*.5,qc=qa+strand+bend;
 vec3 a=qa-rd*dot(qa,rd),b=qb-rd*dot(qb,rd),c=qc-rd*dot(qc,rd);
 float winding=dot(cross(b-a,c-a),rd);
 float ab=dot(cross(b-a,-a),rd)*winding,bc=dot(cross(c-b,-b),rd)*winding,ca=dot(cross(a-c,-c),rd)*winding;
 if(abs(winding)>1.e-12&&ab>=0.&&bc>=0.&&ca>=0.)return false;
 float dist2=min(segmentDistanceSquared(a,b),min(segmentDistanceSquared(b,c),segmentDistanceSquared(c,a)));
 vec3 forward=normalize(uTarget-uEye);float zmax=max(dot(qa,forward),max(dot(qb,forward),dot(qc,forward)))+length(curl);
 float support=max(radius,1.25*zmax*.34/uSize.y);
 float margin=max(.001,5.e-6*max(length(qa),length(qc))),bound=length(curl)+support+margin;
 return dist2>bound*bound;
}
vec3 fibreComposite(vec3 ro,vec3 rd,vec3 colour,float opaqueDepth){
 ivec2 tile=ivec2(gl_FragCoord.xy)/16;uvec2 range=texelFetch(uFibreOffsets,ivec2(tile.x,tile.y),0).rg;
 vec3 scattered=vec3(0.);float tau=0.;
 for(uint i=0u;i<4096u;i++){if(i>=range.y)break;uint at=range.x+i;uint id=texelFetch(uFibreIndices,ivec2(int(at)%uIndexTextureWidth,int(at)/uIndexTextureWidth),0).r;
  vec4 bounds=fibreWord(id*7u+6u);if(any(lessThan(gl_FragCoord.xy,bounds.xy))||any(greaterThan(gl_FragCoord.xy,bounds.zw)))continue;
  vec4 a=fibreWord(id*7u),b=fibreWord(id*7u+1u),c=fibreWord(id*7u+2u),d=fibreWord(id*7u+3u),e=fibreWord(id*7u+4u),rootNormal=fibreWord(id*7u+5u);
  if(uHullPrune&&outsideFibreControlHull(ro,rd,a.xyz,b.xyz,c.xyz,d.xyz,a.w))continue;
  // Minimize ray-to-CONTINUOUS original fibre curve, then integrate its taper
  // over the pixel cone. Bounds and data are rebuildable acceleration caches.
  float best=1.e9,tbest=0.;
  for(int seed=0;seed<3;seed++){float t=(float(seed)+.5)/3.;for(int j=0;j<6;j++){
   float w=b.w,pi=3.141592654;vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,w,t),v=b.xyz+2.*c.xyz*t+d.xyz*(w*cos(w*t)*sin(pi*t)+pi*sin(w*t)*cos(pi*t));
   vec3 acc=2.*c.xyz+d.xyz*((-w*w-pi*pi)*sin(w*t)*sin(pi*t)+2.*w*pi*cos(w*t)*cos(pi*t));
   vec3 q=p-ro;vec3 r=q-rd*dot(q,rd),dp=v-rd*dot(v,rd);float den=dot(dp,dp)+dot(r,acc-rd*dot(acc,rd));if(abs(den)<1.e-10)break;
   float nextT=clamp(t-clamp(dot(r,dp)/den,-.22,.22),0.,1.);
   // A bit-identical iterate repeats exactly the same pure function inputs.
   // Stop only that redundant work; no epsilon or acceptance limit is relaxed.
   if(uStopAtExactStall&&floatBitsToUint(nextT)==floatBitsToUint(t)){t=nextT;break;}t=nextT;
  }vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,b.w,t),q=p-ro;float dist=length(q-rd*dot(q,rd));if(dist<best){best=dist;tbest=t;}}
  vec3 p=path(a.xyz,b.xyz,c.xyz,d.xyz,b.w,tbest),q=p-ro;float depth=dot(q,rd);if(depth<0.||depth>opaqueDepth+.001)continue;
  // Reproduce the source's compact reconstruction kernel. A broad Gaussian
  // with similar total area turns a visible fine strand into a powdery blob.
  // Width tapers, while source optical alpha has its own independent tip law.
  float viewDepth=dot(q,normalize(uTarget-uEye)),footprint=2.*viewDepth*.34/uSize.y,actualPixels=2.*a.w/footprint,reconstruction=1.25;
  float halfWidth=.5*max(reconstruction,actualPixels)*(1.-.75*tbest),edge=best/max(.000001,footprint*halfWidth);
  float coverage=1.-smoothstep(.45,1.,edge);if(coverage<.00001)continue;
  float alpha=(1.-pow(max(.000001,1.-min(1.,actualPixels/reconstruction)),c.w*mix(1.,3.,e.z)))*(1.-tbest*.35)*.94*coverage;
  float optical=-log(max(.0001,1.-min(.96,alpha)));
  vec3 T=normalize(b.xyz+2.*c.xyz*tbest+d.xyz*(b.w*cos(b.w*tbest)*sin(3.141592654*tbest)+3.141592654*sin(b.w*tbest)*cos(3.141592654*tbest))),N=normalize(rootNormal.xyz);
  // Source short-fibre colour belongs to its whole needle and original root ID.
  // Its dye variation is separate from the yarn body's arc variation.
  vec3 dye=needlePalette(d.w+.5,e.x)*e.w;
  vec3 light=lightSourceFibre(T,N,-rd,dye,tbest);
  scattered+=light*optical;tau+=optical;
 }
 if(tau<.00001)return colour;float transmit=exp(-tau*uFuzz);return colour*transmit+(scattered/tau)*(1.-transmit);
}
