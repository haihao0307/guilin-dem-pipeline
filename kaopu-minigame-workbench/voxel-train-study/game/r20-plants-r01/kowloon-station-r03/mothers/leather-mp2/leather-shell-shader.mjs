// Exact leatherShader export separated from unrelated cotton imports.
import {leatherFieldGLSL} from './leather-field.mjs';
export const leatherShader=`attribute vec3 baseNormal;attribute float shellLayer,shellRim;uniform float uThickness,uDepth,uTile,uPlain;uniform vec3 uDye;varying vec3 vSolidColour;varying vec3 vSolidCoord;${leatherFieldGLSL}
void solidVertex(out vec3 P,out vec3 NN){vec2 q=uv/uTile;vec4 f=leatherField(q);float height=uThickness+(f.x-.5)*uDepth;P=position+baseNormal*(.2+shellLayer*height)*.001;NN=normal;if(shellRim<.5&&shellLayer>.5){float e=.08;float dx=(leatherField(q+vec2(e/uTile,0.)).x-leatherField(q-vec2(e/uTile,0.)).x)*uDepth/(2.*e),dy=(leatherField(q+vec2(0.,e/uTile)).x-leatherField(q-vec2(0.,e/uTile)).x)*uDepth/(2.*e);vec3 axis=abs(baseNormal.y)<.85?vec3(0,1,0):vec3(1,0,0),T=normalize(cross(axis,baseNormal)),B=cross(baseNormal,T);NN=normalize(baseNormal-T*dx-B*dy);}
vSolidColour=uDye*(.90+.18*f.w);if(shellLayer<.5||shellRim>.5)vSolidColour*=vec3(1.18,1.08,.92);vSolidColour=mix(vSolidColour,vec3(.52),uPlain);vSolidCoord=vec3(uv,0.);}`;

