/* Original appearance-only integration. No geometry, mechanical clock or textures. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createSurfaceAppearance = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (scene, dynamic, M, createCoordinates, renderHeight) {
  'use strict';
  renderHeight=renderHeight??400;
  if(!Number.isInteger(renderHeight)||renderHeight<16)throw Error('Render height must be an integer of at least 16 pixels');
  const coordinates = createCoordinates(scene, dynamic);
  const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
  const norm = a => Math.hypot(...a);
  const unit = a => { const l=norm(a); if (!(l>0)) throw Error('Nonzero vector required'); return a.map(v=>v/l); };
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const assignments = new Map(scene.parts.map(p=>[p.id,Object.freeze(M.assignMaterial(p))]));
  function snapshot(value={}) {
    if (typeof value === 'string') value={mode:value};
    const mode=value.mode??'waves', detailScale=value.detailScale??1;
    if (!['diagnostic','waves'].includes(mode)) throw Error('Appearance is diagnostic or waves, never a mechanical state');
    if (!Number.isFinite(detailScale)||detailScale<0||detailScale>1) throw Error('Appearance detailScale must be in [0,1]');
    return Object.freeze({mode,detailScale});
  }
  function frame(part,theta,installation) {
    return {coordinates:coordinates.frame(part,theta,installation),assignment:assignments.get(part.id)};
  }
  function coverage(installation) {
    const counts={},basisCounts={};let visible=0,stack=0;
    for (const part of scene.parts) if (dynamic.visible(part,installation)) {
      const a=assignments.get(part.id);visible++;if(part.source==='stack')stack++;
      counts[a.preset]=(counts[a.preset]||0)+1;basisCounts[a.basis]=(basisCounts[a.basis]||0)+1;
    }
    return {visible,stack,counts,basisCounts,assignedWaveFields:visible};
  }
  // A conservative bound for the intersection of a pixel cone with the local
  // tangent plane. A normalized perspective ray changes by at most epsilon.
  // |delta p| <= 2*t*epsilon/(|n.ray|-epsilon). Surface curvature/occlusion
  // discontinuities are NOT certified by a local tangent estimate. At grazing
  // incidence or an unavailable normal, omit detail rather than undersample it.
  function footprintRadius(distance,normal,ray,height=renderHeight) {
    if(!Number.isInteger(height)||height<16)throw Error('Render height must be an integer of at least 16 pixels');
    const rayEpsilon=1.2/height*Math.SQRT2;
    if (!Number.isFinite(distance)||distance<0) throw Error('Finite hit distance required');
    const incidence=Math.abs(dot(unit(normal),unit(ray)));
    return incidence<=.15 ? 1e20 : 2*distance*rayEpsilon/(incidence-rayEpsilon);
  }
  function detailWeight(wave,radius) {
    if (!(radius>=0)) throw Error('Nonnegative footprint radius required');
    const excursion=2*radius*(norm(wave.k)+Math.abs(wave.modulation)*norm(wave.l));
    const x=clamp((excursion-Math.PI/4)/(Math.PI/4),0,1);
    return 1-x*x*(3-2*x);
  }
  function filteredSample(q,n,rows,name,radius,detailScale=1,diagnosticColor) {
    const material=M.presets[name];let height=0;const gradient=[0,0,0],weights=[];
    for(const w of material.waves) {
      const weight=detailScale*detailWeight(w,radius),v=dot(w.l,q)+w.modulationPhase;
      const phase=dot(w.k,q)+w.phase+w.modulation*Math.sin(v);weights.push(weight);
      height+=weight*w.amplitude*Math.sin(phase);
      for(let j=0;j<3;j++)gradient[j]+=weight*w.amplitude*Math.cos(phase)*(w.k[j]+w.modulation*Math.cos(v)*w.l[j]);
    }
    const g=[0,1,2].map(j=>rows.reduce((s,r,k)=>s+r[j]*gradient[k],0));
    const bound=M.bounds(name).height,signal=bound>0?height/bound:0;
    const color=name==='neutral'&&diagnosticColor?diagnosticColor:material.albedo;
    return {normal:M.perturbNormal(n,g,material.maxSlope),albedo:color.map(v=>clamp(v*(1+material.albedoVariation*signal),0,1)),
      roughness:clamp(material.roughness+material.roughnessVariation*signal,.04,1),metallic:material.metallic,
      virtualHeight:height,weights,geometryDisplacement:0};
  }
  function lighting(shading,view,light=unit([.6,.9,.4])) {
    const V=unit(view),L=unit(light);let N=unit(shading.normal);if(dot(N,V)<0)N=N.map(v=>-v);
    const half=V.map((v,i)=>v+L[i]),H=norm(half)>1e-9?unit(half):N,NV=Math.max(dot(N,V),.001),NL=Math.max(dot(N,L),0),NH=Math.max(dot(N,H),0),VH=Math.max(dot(V,H),0);
    const r=clamp(shading.roughness,.04,1),a=r*r,a2=a*a,d=NH*NH*(a2-1)+1;
    const distribution=a2/(Math.PI*d*d),k=(r+1)*(r+1)/8;
    const mask=NV/(NV*(1-k)+k)*NL/Math.max(NL*(1-k)+k,1e-8);
    return shading.albedo.map((base,i)=>{
      const F0=.04*(1-shading.metallic)+base*shading.metallic,F=F0+(1-F0)*Math.pow(1-VH,5);
      const specular=distribution*mask*F/Math.max(4*NV*NL,1e-6),diffuse=(1-F)*(1-shading.metallic)*base/Math.PI;
      const radiance=.38*base+1.7*NL*(diffuse+specular)+.08*F;
      return Math.pow(radiance/(1+radiance),1/2.2);
    });
  }
  const glsl=M.generateGLSL()+`
// Appearance is sampled only after the UNCHANGED scalar intersection and normal.
uniform int surfaceAppearance,materialIndex;
uniform float surfaceDetailScale;${renderHeight===400?'':'\nuniform float surfaceRayEpsilon;'}
uniform vec4 materialInverseRow0,materialInverseRow1,materialInverseRow2;
float surfaceFootprint(float distance,vec3 n,vec3 ray) {
  float incidence=abs(dot(n,ray));if(incidence<=.15)return 1e20;
  ${renderHeight===400?'const float epsilon=.004242640687119285;':'float epsilon=surfaceRayEpsilon;'}
  return 2.*distance*epsilon/(incidence-epsilon);
}
float surfaceWaveWeight(MWWave w,float radius) {
  float excursion=2.*radius*(length(w.k)+abs(w.modulation)*length(w.l));
  return 1.-smoothstep(.7853981633974483,1.5707963267948966,excursion);
}
MWShading surfaceSample(vec3 q,vec3 n,mat3 J,MWMaterial m,float radius) {
  float height=0.,bound=0.;vec3 gradient=vec3(0.);
  for(int i=0;i<4;i++) {
    MWWave w=m.waves[i];float weight=surfaceDetailScale*surfaceWaveWeight(w,radius);
    float v=dot(w.l,q)+w.modulationPhase,phase=dot(w.k,q)+w.phase+w.modulation*sin(v);
    height+=weight*w.amplitude*sin(phase);bound+=abs(w.amplitude);
    gradient+=weight*w.amplitude*cos(phase)*(w.k+w.modulation*cos(v)*w.l);
  }
  float signal=bound>0.?height/bound:0.;MWShading s;
  s.normal=mwNormal(n,transpose(J)*gradient,m.maxSlope);
  s.albedo=clamp(m.albedo*(1.+m.albedoVariation*signal),0.,1.);
  s.roughness=clamp(m.roughness+m.roughnessVariation*signal,.04,1.);s.metallic=m.metallic;return s;
}
// Own implementation of a simple two-sided GGX/Schlick study light. No texture,
// environment map, transmission, shadow, measured BRDF, or historical finish.
vec3 surfaceLight(MWShading s,vec3 view) {
  vec3 V=normalize(view),L=normalize(vec3(.6,.9,.4)),N=s.normal;
  if(dot(N,V)<0.)N=-N;vec3 hv=V+L,H=length(hv)>1e-9?normalize(hv):N;
  float NV=max(dot(N,V),.001),NL=max(dot(N,L),0.),NH=max(dot(N,H),0.),VH=max(dot(V,H),0.);
  float r=clamp(s.roughness,.04,1.),a=r*r,a2=a*a,d=NH*NH*(a2-1.)+1.;
  float distribution=a2/(3.141592653589793*d*d),k=(r+1.)*(r+1.)/8.;
  float masking=NV/(NV*(1.-k)+k)*NL/max(NL*(1.-k)+k,1e-8);
  vec3 F0=mix(vec3(.04),s.albedo,s.metallic),F=F0+(1.-F0)*pow(1.-VH,5.);
  vec3 specular=distribution*masking*F/max(4.*NV*NL,1e-6);
  vec3 diffuse=(1.-F)*(1.-s.metallic)*s.albedo/3.141592653589793;
  vec3 radiance=.38*s.albedo+1.7*NL*(diffuse+specular)+.08*F;
  return pow(radiance/(1.+radiance),vec3(1./2.2));
}
vec3 surfaceColor(vec3 p,vec3 normal,vec3 ray,float hit,float cut,vec3 sourceColor) {
  // Exact legacy diagnostic lighting is retained as an independent appearance.
  float diagnosticLight=.3+.7*abs(dot(normal,normalize(vec3(.6,.9,.4))));
  // Keep diagnostic clipping caps unperturbed. Neither branch changes depth.
  if(surfaceAppearance==0||abs(p.x-cut)<.001)return sourceColor*diagnosticLight;
  MWMaterial m=mwPreset(materialIndex);if(materialIndex==0)m.albedo=sourceColor;
  vec3 q=mwLocalPoint(p,materialInverseRow0,materialInverseRow1,materialInverseRow2);
  mat3 J=mwInverseLinear(materialInverseRow0,materialInverseRow1,materialInverseRow2);
  MWShading s=surfaceSample(q,normal,J,m,surfaceFootprint(hit,normal,ray));
  return surfaceLight(s,-ray);
}
`;
  return Object.freeze({snapshot,frame,coverage,assignments,coordinates,footprintRadius,detailWeight,filteredSample,lighting,glsl});
});
