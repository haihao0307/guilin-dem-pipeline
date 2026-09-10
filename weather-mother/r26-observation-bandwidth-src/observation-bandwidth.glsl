/* Weather Mother R26 observation-bandwidth density refinement.
   This does not change CloudEnvelope identity or camera state. It only limits
   high-frequency render detail as observation distance grows. At w=1 the
   expression is algebraically identical to the R23 five-band field. At w=0
   the first three centered terms keep their original coefficients; omitted
   bands contribute their zero-mean center instead of triggering renormalization. */
float obsWeight(float dist){
  float w=1.-smoothstep(14.,26.,dist);
  if(uObsOverride>=0.) w=sat(uObsOverride);
  return w;
}
float bandsOB(vec3 p,float highGate){
  float a=.5,s=0.;
  for(int i=0;i<5;i++){
    float gate=i<3?1.:highGate;
    s+=a*(yo(p)-.5)*gate;
    p=mat3(.86,.18,.47,-.28,.95,.12,-.42,-.23,.88)*p*2.0+vec3(.37,.19,.53);
    a*=.5;
  }
  return .5+s/.96875;
}
float den(vec3 p,float dist){
  float d=cloudSdf(p);
  if(d>.42||p.y<1.35||p.y>7.5)return 0.;
  float w=obsWeight(dist);
  float low=bandsOB(p*.72+vec3(0.,0.,uTime*.004),w);
  float mid=.5+(bandsOB(p*1.85+vec3(11.3,7.1,3.7),w)-.5)*w;
  float hi=.5+(yo(p*7.3+vec3(2.1,5.7,13.))-.5)*w*w;
  float erode=(low-.52)*.24+(mid-.5)*.10+(hi-.5)*.025;
  float shape=1.-smoothstep(-.28,.18,d+erode);
  float base=smoothstep(1.45,1.85,p.y),top=1.-smoothstep(6.25,7.15,p.y);
  return sat(shape*base*top*(uScene<.5?1.08:.78));
}
