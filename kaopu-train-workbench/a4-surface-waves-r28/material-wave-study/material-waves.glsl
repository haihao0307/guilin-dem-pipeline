// ORIGINAL SHADING-ONLY WAVES. Generated from material-waves.js.
// Include after precision highp float; precision highp int; in GLSL ES 3.00.
// No time, texture, geometry displacement, field, depth, opacity or collision edits.
struct MWWave { float amplitude; vec3 k; float phase; float modulation; vec3 l; float modulationPhase; };
struct MWMaterial { vec3 albedo; float roughness; float metallic; float maxSlope; float albedoVariation; float roughnessVariation; MWWave waves[4]; };
struct MWValue { float height; vec3 gradient; float heightBound; };
struct MWShading { vec3 normal; vec3 albedo; float roughness; float metallic; };
MWMaterial mwPreset(int id) {
  MWMaterial m;
  if (id == 0) {
    m.albedo = vec3(0.56,0.62,0.65); m.roughness = 0.62; m.metallic = 0.0;
    m.maxSlope = 0.008; m.albedoVariation = 0.025; m.roughnessVariation = 0.014;
    m.waves[0] = MWWave(0.000012, vec3(1.7,0.6,0.8), 0.7, 0.15, vec3(0.3,0.7,0.2), 1.1);
    m.waves[1] = MWWave(0.000005, vec3(17.0,7.0,11.0), 1.6, 0.12, vec3(2.0,1.0,3.0), 0.4);
    m.waves[2] = MWWave(0.000002, vec3(101.0,23.0,41.0), 2.2, 0.08, vec3(3.0,7.0,2.0), 0.9);
    m.waves[3] = MWWave(0.0, vec3(0.0,0.0,0.0), 0.0, 0.0, vec3(0.0,0.0,0.0), 0.0);
    return m;
  }
  if (id == 1) {
    m.albedo = vec3(0.48,0.51,0.54); m.roughness = 0.42; m.metallic = 0.95;
    m.maxSlope = 0.012; m.albedoVariation = 0.018; m.roughnessVariation = 0.012;
    m.waves[0] = MWWave(0.000004, vec3(430.0,27.0,13.0), 0.3, 0.18, vec3(3.0,17.0,5.0), 0.7);
    m.waves[1] = MWWave(0.000002, vec3(31.0,97.0,23.0), 1.1, 0.12, vec3(5.0,2.0,13.0), 0.2);
    m.waves[2] = MWWave(0.000001, vec3(11.0,37.0,251.0), 2.2, 0.08, vec3(7.0,3.0,2.0), 1.0);
    m.waves[3] = MWWave(0.000018, vec3(1.4,0.5,1.1), 0.85, 0.16, vec3(0.4,0.3,0.6), 0.5);
    return m;
  }
  if (id == 2) {
    m.albedo = vec3(0.66,0.32,0.19); m.roughness = 0.38; m.metallic = 0.95;
    m.maxSlope = 0.012; m.albedoVariation = 0.02; m.roughnessVariation = 0.012;
    m.waves[0] = MWWave(0.000005, vec3(41.0,281.0,19.0), 0.2, 0.2, vec3(11.0,2.0,7.0), 1.0);
    m.waves[1] = MWWave(0.000003, vec3(127.0,13.0,31.0), 1.7, 0.16, vec3(3.0,7.0,13.0), 0.4);
    m.waves[2] = MWWave(0.000001, vec3(17.0,23.0,367.0), 0.8, 0.08, vec3(5.0,11.0,2.0), 1.5);
    m.waves[3] = MWWave(0.000018, vec3(1.4,0.5,1.1), 0.85, 0.16, vec3(0.4,0.3,0.6), 0.5);
    return m;
  }
  if (id == 3) {
    m.albedo = vec3(0.67,0.52,0.23); m.roughness = 0.34; m.metallic = 0.95;
    m.maxSlope = 0.01; m.albedoVariation = 0.018; m.roughnessVariation = 0.01;
    m.waves[0] = MWWave(0.000004, vec3(317.0,11.0,23.0), 0.6, 0.16, vec3(3.0,13.0,7.0), 0.8);
    m.waves[1] = MWWave(0.000002, vec3(19.0,73.0,149.0), 1.9, 0.1, vec3(11.0,5.0,2.0), 0.3);
    m.waves[2] = MWWave(0.000001, vec3(61.0,229.0,7.0), 2.4, 0.08, vec3(2.0,7.0,11.0), 0.9);
    m.waves[3] = MWWave(0.0, vec3(0.0,0.0,0.0), 0.0, 0.0, vec3(0.0,0.0,0.0), 0.0);
    return m;
  }
  if (id == 4) {
    m.albedo = vec3(0.25,0.13,0.065); m.roughness = 0.76; m.metallic = 0.0;
    m.maxSlope = 0.025; m.albedoVariation = 0.035; m.roughnessVariation = 0.018;
    m.waves[0] = MWWave(0.000025, vec3(210.0,7.0,5.0), 0.4, 0.38, vec3(3.0,2.0,11.0), 0.9);
    m.waves[1] = MWWave(0.00001, vec3(401.0,3.0,11.0), 1.3, 0.24, vec3(7.0,2.0,5.0), 0.4);
    m.waves[2] = MWWave(0.000004, vec3(17.0,67.0,13.0), 2.1, 0.15, vec3(2.0,3.0,7.0), 1.7);
    m.waves[3] = MWWave(0.000018, vec3(1.4,0.5,1.1), 0.85, 0.16, vec3(0.4,0.3,0.6), 0.5);
    return m;
  }
  if (id == 5) {
    m.albedo = vec3(0.08,0.16,0.19); m.roughness = 0.12; m.metallic = 0.0;
    m.maxSlope = 0.02; m.albedoVariation = 0.01; m.roughnessVariation = 0.008;
    m.waves[0] = MWWave(0.00008, vec3(19.0,0.0,11.0), 0.5, 0.15, vec3(2.0,0.0,3.0), 0.4);
    m.waves[1] = MWWave(0.00004, vec3(7.0,0.0,37.0), 1.2, 0.12, vec3(3.0,0.0,2.0), 1.1);
    m.waves[2] = MWWave(0.00002, vec3(47.0,0.0,17.0), 2.0, 0.08, vec3(1.0,0.0,5.0), 0.3);
    m.waves[3] = MWWave(0.0, vec3(0.0,0.0,0.0), 0.0, 0.0, vec3(0.0,0.0,0.0), 0.0);
    return m;
  }
  if (id == 6) {
    m.albedo = vec3(0.32,0.39,0.41); m.roughness = 0.1; m.metallic = 0.0;
    m.maxSlope = 0.005; m.albedoVariation = 0.004; m.roughnessVariation = 0.004;
    m.waves[0] = MWWave(5e-7, vec3(37.0,23.0,17.0), 0.1, 0.08, vec3(2.0,3.0,5.0), 0.7);
    m.waves[1] = MWWave(3e-7, vec3(13.0,71.0,31.0), 1.6, 0.06, vec3(5.0,2.0,3.0), 1.2);
    m.waves[2] = MWWave(2e-7, vec3(59.0,11.0,43.0), 2.3, 0.04, vec3(3.0,5.0,2.0), 0.2);
    m.waves[3] = MWWave(0.0, vec3(0.0,0.0,0.0), 0.0, 0.0, vec3(0.0,0.0,0.0), 0.0);
    return m;
  }
  // Unknown ID falls back to a deterministic neutral, not uninitialized data.
  m.albedo=vec3(.56,.62,.65); m.roughness=.62; m.metallic=0.; m.maxSlope=0.; m.albedoVariation=0.; m.roughnessVariation=0.;
  for(int i=0;i<4;i++)m.waves[i]=MWWave(0.,vec3(0.),0.,0.,vec3(0.),0.);
  return m;
}
MWValue mwHeightGradient(vec3 q, MWMaterial m, float detailWeight) {
  MWValue w; w.height=0.; w.gradient=vec3(0.); w.heightBound=0.;
  for(int i=0;i<4;i++) {
    MWWave a=m.waves[i]; float v=dot(a.l,q)+a.modulationPhase;
    float phase=dot(a.k,q)+a.phase+a.modulation*sin(v);
    w.height+=a.amplitude*sin(phase);
    w.gradient+=a.amplitude*cos(phase)*(a.k+a.modulation*cos(v)*a.l);
    w.heightBound+=abs(a.amplitude);
  }
  w.height*=clamp(detailWeight,0.,1.); w.gradient*=clamp(detailWeight,0.,1.);
  return w;
}
vec3 mwNormal(vec3 normalWorld, vec3 gradientWorld, float maxSlope) {
  vec3 n=normalize(normalWorld); vec3 t=gradientWorld-n*dot(n,gradientWorld);
  float slope=length(t); if(slope>maxSlope)t*=maxSlope/max(slope,1e-20);
  return normalize(n-t);
}
MWShading mwShade(vec3 q, vec3 normalWorld, mat3 worldToMaterialLinear, MWMaterial m, float detailWeight) {
  MWValue w=mwHeightGradient(q,m,detailWeight);
  float signal=w.heightBound>0.?w.height/w.heightBound:0.;
  MWShading s; s.normal=mwNormal(normalWorld,transpose(worldToMaterialLinear)*w.gradient,m.maxSlope);
  s.albedo=clamp(m.albedo*(1.+m.albedoVariation*signal),0.,1.);
  s.roughness=clamp(m.roughness+m.roughnessVariation*signal,.04,1.); s.metallic=m.metallic; return s;
}
// Rows uploaded by rigid-coordinates.js, from the SAME mechanical snapshot.
// q_i=dot(inverseRow_i.xyz,pWorld)+inverseRow_i.w.
vec3 mwLocalPoint(vec3 pWorld,vec4 row0,vec4 row1,vec4 row2) {
  vec4 p=vec4(pWorld,1.); return vec3(dot(row0,p),dot(row1,p),dot(row2,p));
}
mat3 mwInverseLinear(vec4 row0,vec4 row1,vec4 row2) {
  return transpose(mat3(row0.xyz,row1.xyz,row2.xyz));
}
// View-only detail weight. Exact gradient above is with this weight held fixed.
// Bound phase excursion across each pixel; no time-dependent material phase.
float mwDetailWeight(MWMaterial m,vec3 dqdx,vec3 dqdy) {
  float excursion=0.;
  for(int i=0;i<4;i++){MWWave a=m.waves[i];if(a.amplitude==0.)continue;
    float x=abs(dot(a.k,dqdx))+abs(a.modulation)*abs(dot(a.l,dqdx));
    float y=abs(dot(a.k,dqdy))+abs(a.modulation)*abs(dot(a.l,dqdy));
    excursion=max(excursion,x+y);}
  return 1.-smoothstep(.78539816339,1.57079632679,excursion);
}
