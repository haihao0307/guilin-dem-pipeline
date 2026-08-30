(() => {
'use strict';
const base = window.LandscapeMotherTerrainShaders;
const original = `vec3 truthRamp(float t){return clut5(t,vec3(.075,.13,.10),vec3(.16,.25,.14),vec3(.31,.34,.19),vec3(.47,.44,.29),vec3(.73,.72,.64));}`;
const replacement = `vec3 truthRamp(float t){return clut5(t,vec3(.040,.075,.058),vec3(.11,.21,.105),vec3(.28,.34,.16),vec3(.52,.48,.30),vec3(.84,.82,.72));}`;
const fragment = base.TERRAIN_FRAGMENT_SHADER.replace(original, replacement);
if (!fragment.includes(replacement)) {
  throw new Error('Landscape Mother truth-clarity shader transfer failed');
}
window.LandscapeMotherTerrainShaders = Object.freeze({
  TERRAIN_VERTEX_SHADER: base.TERRAIN_VERTEX_SHADER,
  TERRAIN_FRAGMENT_SHADER: fragment,
});
})();
