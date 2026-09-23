(() => {
'use strict';
const WATER_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aMeta;
uniform mat4 uViewProjection;
out vec3 vWorld;
out vec3 vMeta;
void main(){vWorld=aPosition;vMeta=aMeta;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;

const WATER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorld;
in vec3 vMeta;
uniform vec3 uEye;
uniform float uTime;
out vec4 outColor;
void main(){
  vec3 viewDirection=normalize(uEye-vWorld);
  float fresnel=pow(1.0-clamp(viewDirection.y,0.0,1.0),2.4);
  float ripple=sin(vWorld.x*.075+uTime*.72)+sin(vWorld.z*.092-uTime*.57)+sin((vWorld.x+vWorld.z)*.031+uTime*.35);
  vec3 river=vec3(.035,.205,.265);
  vec3 stream=vec3(.045,.27,.31);
  vec3 canal=vec3(.065,.30,.32);
  vec3 base=vMeta.x<.5?river:(vMeta.x<1.5?stream:canal);
  vec3 color=mix(base,vec3(.22,.50,.53),.14+fresnel*.52)+ripple*.005;
  outColor=vec4(color,vMeta.x<.5?.88:.76);
}`;

const SKIRT_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
uniform mat4 uViewProjection;
out float vHeight;
void main(){vHeight=aPosition.y;gl_Position=uViewProjection*vec4(aPosition,1.0);}`;

const SKIRT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vHeight;
out vec4 outColor;
void main(){float t=clamp((vHeight+70.0)/180.0,0.0,1.0);outColor=vec4(mix(vec3(.035,.030,.024),vec3(.17,.135,.079),t),1.0);}`;

window.LandscapeMotherWaterShaders = Object.freeze({
  WATER_VERTEX_SHADER,
  WATER_FRAGMENT_SHADER,
  SKIRT_VERTEX_SHADER,
  SKIRT_FRAGMENT_SHADER,
});
})();
