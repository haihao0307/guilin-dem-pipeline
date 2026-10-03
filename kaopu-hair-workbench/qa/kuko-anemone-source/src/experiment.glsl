// KAOPU bounded finite-cluster study, adapted from the user-provided KuKo teacher.
// The teacher's lighting and color functions are retained. This is a deformed
// capsule distance estimator, not a tissue transport or contact dynamics solver.
uniform vec4 uRoots[9];
uniform float uCurrent;
uniform float uNoise;
uniform float uLength;
uniform vec3 uRootColor;
uniform vec3 uMidColor;
uniform vec3 uTipColor;
float studyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y)*2.-1.;}
float studyBody(vec3 p){vec2 d=vec2(length(p.xz)-1.15,abs(p.y+1.08)-.18);return length(max(d,0.))+min(max(d.x,d.y),0.);}
float studyMap(vec3 p){
  // The scene is contained by this box for every allowed setting. Outside it,
  // its distance is a conservative lower bound, avoiding unnecessary tube work.
  vec3 q=abs(p-vec3(0.,.10,0.))-vec3(1.32,1.45,1.32);
  float box=length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);
  if(box>.20)return box;
  float d=studyBody(p);
  for(int i=0;i<9;i++){
    vec4 r=uRoots[i];float len=r.z*uLength;
    vec3 wp=p-vec3(r.x,-.90,r.y);float s=clamp(wp.y/len,0.,1.);
    // Every lateral component vanishes at the root. Horizontal displacement
    // norm is bounded by .10 + .04*current + .03*noise <= .17 world units.
    vec2 rest=vec2(cos(r.w),sin(r.w))*(.10*sin(s*2.25));
    vec2 flow=vec2(0.);if(uCurrent>0.)flow=vec2(.894427,.447214)*(.04*uCurrent*sin(T*.9-s*1.4)*s*s);
    float n=0.;if(uNoise>0.)n=studyNoise(vec2(r.x*.48+T*.23,r.y*.48-T*.16));
    vec2 eddy=vec2(-.447214,.894427)*(.03*uNoise*n*s*s);
    wp.xz-=rest+flow+eddy;
    float h=clamp(wp.y,0.,len);
    // .80 is conservative for this bounded, gently bent field; it preserves
    // the zero surface while reducing sphere-tracing steps through its warp.
    d=min(d,(length(wp-vec3(0.,h,0.))-.09)*.80);
  }
  return d;
}
float map(vec3 p){return studyMap(p);}

vec3 studyPalette(vec3 p){int nearest=0;float best=1e6;for(int i=0;i<9;i++){vec2 d=p.xz-uRoots[i].xy;float d2=dot(d,d);if(d2<best){best=d2;nearest=i;}}float s=clamp((p.y+.90)/(uRoots[nearest].z*uLength),0.,1.);vec3 flesh=mix(uRootColor,uMidColor,smoothstep(0.,.75,s));return mix(flesh,uTipColor,smoothstep(.90,1.,s));}
