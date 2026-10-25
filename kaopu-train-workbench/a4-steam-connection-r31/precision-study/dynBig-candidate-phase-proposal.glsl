// OPTIONAL FOLLOW-ON ONLY: not applied to dynamic.js or its beta-only proposal.
// Validated phase precision range: |a| <= 16; current UI uses [.4,10.98318530718].
// Outside this range preserve prior builtin behavior, without a precision claim.
vec2 dynCandidatePhaseSinCos(float a){
  if(abs(a)>16.)return vec2(sin(a),cos(a));
  float n=floor(a*.636619772367581343+.5);
  // Split pi/2: n*high is exact for this bounded integer n; low restores precision.
  float r=(a-n*1.5703125)-n*.00048382679489661923;
  float r2=r*r;
  float s=r*(1.+r2*(-1./6.+r2*(1./120.+r2*(-1./5040.+r2*(1./362880.-r2/39916800.)))));
  float c=1.+r2*(-.5+r2*(1./24.+r2*(-1./720.+r2*(1./40320.-r2/3628800.))));
  int quadrant=int(mod(n,4.));
  return quadrant==0?vec2(s,c):quadrant==1?vec2(c,-s):quadrant==2?vec2(-s,-c):vec2(-c,s);
}
// Replace ONLY the existing dynBig body with this candidate-gated form.
vec2 dynBig(float t,int side){float phase=side==0?0.0:(side==1?1.7:4.3);vec2 sc=installationCandidate==1?dynCandidatePhaseSinCos(t+phase):vec2(sin(t+phase),cos(t+phase));return vec2(1.016,0)+.3302*sc;}
