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
float studyBody(vec3 p){float edge=1.13+.025*sin(p.x*3.)+.020*sin(p.z*4.);return (length(vec2(max(length(p.xz)-edge,0.),p.y+1.0))-.10)*.80;}
float studyMap(vec3 p){
  // The scene is contained by this box for every allowed setting. Outside it,
  // its distance is a conservative lower bound, avoiding unnecessary tube work.
  vec3 q=abs(p-vec3(0.,.08,0.))-vec3(1.50,1.50,1.50);
  float box=length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.);
  if(box>.20)return box;
  float d=studyBody(p);
  for(int i=0;i<9;i++){
    vec4 r=uRoots[i];float len=r.z*uLength;
    vec3 wp=p-vec3(r.x,-.90,r.y);float s=clamp(wp.y/len,0.,1.);
    // Every lateral component vanishes at the root. Horizontal displacement
    // norm is bounded by .18 + .05*current + .035*noise <= .265 world units.
    vec2 rest=vec2(cos(r.w),sin(r.w))*(.18*sin(s*4.8));
    vec2 flow=vec2(0.);if(uCurrent>0.)flow=vec2(.894427,.447214)*(.05*uCurrent*sin(T*.9-s*1.4)*s*s);
    float n=0.;if(uNoise>0.)n=studyNoise(vec2(r.x*.48+T*.23,r.y*.48-T*.16));
    vec2 eddy=vec2(-.447214,.894427)*(.035*uNoise*n*s*s);
    wp.xz-=rest+flow+eddy;
    float h=clamp(wp.y,0.,len);
    // .60 bounds the bent/tapered field gradient; it preserves
    // the zero surface while reducing sphere-tracing steps through its warp.
    float radius=mix(.11,.065,s*s*(3.-2.*s));
    d=min(d,(length(wp-vec3(0.,h,0.))-radius)*.60);
  }
  return d;
}
float map(vec3 p){return studyMap(p);}

vec3 studyPalette(vec3 p){int nearest=0;float best=1e6;for(int i=0;i<9;i++){vec2 d=p.xz-uRoots[i].xy;float d2=dot(d,d);if(d2<best){best=d2;nearest=i;}}float s=clamp((p.y+.90)/(uRoots[nearest].z*uLength),0.,1.);vec3 flesh=mix(uRootColor,uMidColor,smoothstep(0.,.75,s));return mix(flesh,uTipColor,smoothstep(.90,1.,s));}
