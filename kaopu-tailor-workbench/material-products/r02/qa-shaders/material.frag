#version 300 es
precision highp float;in vec3 vSolidColour;in vec3 vSolidCoord;out vec4 outputColor;void main(){outputColor=vec4(vSolidColour+vSolidCoord*.0,1.);}
