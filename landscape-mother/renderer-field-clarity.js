(() => {
'use strict';
const base = window.LandscapeMotherTerrainShaders;
let fragment = base.TERRAIN_FRAGMENT_SHADER;
fragment = fragment.replace(
  `  paddyColor*=mix(1.04,.67,wet*.73);\n\n  float bare=max(0.0,1.0-rock-paddy*.75-alluvium*.55);\n  vec4 weights=splat(bare,paddy,rock,max(alluvium,sediment*.65),.74);`,
  `  paddyColor*=mix(1.04,.67,wet*.73);\n  float paddySharp=smoothstep(.10,.42,paddy);\n  float bundSharp=smoothstep(.025,.17,bund);\n  float ditchSharp=smoothstep(.018,.135,ditch);\n\n  float bare=max(0.0,1.0-rock-paddySharp*.78-alluvium*.55);\n  vec4 weights=splat(bare,paddySharp,rock,max(alluvium,sediment*.65),.74);`,
);
fragment = fragment.replace(
  `  color=mix(color,vec3(.15,.095,.035),bund*.72);\n  color=mix(color,vec3(.045,.26,.31),ditch*.75+wet*.06);`,
  `  color=mix(color,vec3(.15,.095,.035),bundSharp*.78);\n  color=mix(color,vec3(.035,.29,.35),ditchSharp*.82+wet*.06);`,
);
fragment = fragment.replace(
  `  }else if(uMode==3){\n    color=mix(vec3(.055,.068,.045),paddyColor,pow(paddy,.56));\n    color=mix(color,vec3(.33,.17,.045),pow(bund,.52));\n    color=mix(color,vec3(.04,.46,.56),pow(ditch,.49));`,
  `  }else if(uMode==3){\n    color=mix(vec3(.035,.045,.030),paddyColor,paddySharp);\n    color=mix(color,vec3(.43,.20,.040),bundSharp);\n    color=mix(color,vec3(.025,.58,.67),ditchSharp);\n    float fieldEdge=sat(bundSharp+ditchSharp);\n    color=mix(color,color*1.18+vec3(.035,.020,.005),fieldEdge*.42);`,
);
if (!fragment.includes('float fieldEdge=sat(bundSharp+ditchSharp);')) {
  throw new Error('Landscape Mother field-clarity shader transfer failed');
}
window.LandscapeMotherTerrainShaders = Object.freeze({
  TERRAIN_VERTEX_SHADER: base.TERRAIN_VERTEX_SHADER,
  TERRAIN_FRAGMENT_SHADER: fragment,
});
})();
