import {bindingGLSL} from './surface-binding.mjs';
import {leatherFieldGLSL} from './leather-field.mjs';
export const yarnShader=`
attribute vec4 yarnInterval;attribute vec2 yarnEnds;attribute vec3 tubeCoordinate;attribute float tubeCap;
uniform float uKnit,uKind,uPitch,uWeftPitch,uThickness,uRadius,uPattern,uReverse,uDepth,uTwist,uOffset,uPlain,uPlies,uLOD,uPacking,uFuzz;
uniform vec2 uShift;uniform vec3 uDye,uContrast,uWeftDye;varying vec3 vSolidColour;varying vec3 vSolidCoord;
const float TAU=6.28318530718,COURSE=.716197243913;
${bindingGLSL}
float colourAt(float col,float row){vec2 p=mod(vec2(col,row),16.);if(uPattern<.5)return 0.;if(uPattern>2.5&&uPattern<3.5)return mod(p.y,8.)<4.?0.:1.;float d=abs(p.x-7.5)+abs(p.y-7.5);return abs(d-6.)<1.1?1.:(mod(p.x+p.y,5.)<.5?1.:0.);}
float sm7(float t){t=clamp(t,0.,1.);return t*t*t*t*(35.+t*(-84.+t*(70.-20.*t)));}
float draft(float x,float y){return mod(y-x,4.)<2.999?1.:-1.;}
vec3 restYarn(float t,float lane,float carrier){if(uKnit>.5){float u=fract(t),a=TAU*u;bool working=uPattern<.5||abs(colourAt(floor(t),lane)-carrier)<.1;vec3 p=vec3(t+.238732414638*sin(2.*a),lane*COURSE+.636619772368*cos(a),-.159154943092*cos(2.*a));
 if(!working){p=vec3(t,lane*COURSE+.636619772368,-.159154943092);for(int e=0;e<2;e++){float v=e==0?u:1.-u;if(v<.3)p.y-=.785398163397*v*v*(1.-sm7(v/.3));}}
 p*=uPitch;p.xy+=uShift;p.z*=uReverse*uDepth;if(uPattern>.5&&uPattern<2.5)p.z-=(working?1.-sm7(min(u,1.-u)/.3):1.)*uRadius*.9;return p;}
 float crossPitch=uKind<.5?uWeftPitch:uPitch,q=t/crossPitch,a=floor(q-.5),f=fract(q-.5);f=f*f*(3.-2.*f);float aa=uKind<.5?draft(lane,a):-draft(a,lane),bb=uKind<.5?draft(lane,a+1.):-draft(a+1.,lane);
 // At subpixel distance the closed tubes retain their pitch and width while
 // the crimp is low-pass filtered; microscope LOD restores the crossing wave.
 float filter=uLOD<.5?.18:1.;float z=mix(aa,bb,f)*uThickness*.265*filter+(uLOD<.5?(uKind<.5?.13:-.13)*uThickness:0.);
 return uKind<.5?vec3((lane+.5)*uPitch,t,z):vec3(t,(lane+.5)*uWeftPitch,z);}
void solidVertex(out vec3 P,out vec3 NN){float t=mix(yarnInterval.x,yarnInterval.y,tubeCoordinate.x),lane=yarnInterval.z,carrier=yarnInterval.w,theta=tubeCoordinate.y,ply=tubeCoordinate.z;float eps=uKnit>.5?.0005:.008;
 vec3 q=restYarn(t,lane,carrier),N,U,V;surfaceFrame(q.xy,P,N,U,V);vec3 dq=(restYarn(t+eps,lane,carrier)-restYarn(t-eps,lane,carrier))/(2.*eps),T=normalize(U*dq.x+V*dq.y+N*dq.z*.001),B=normalize(cross(T,N)+vec3(1e-12)),W=normalize(cross(B,T));P+=N*(uOffset+q.z)*.001;
 float arc=uKnit>.5?t*uPitch*3.926862432:t,phase=TAU*arc/uTwist+lane*.31;float radius=uRadius*(1.+.035*sin(arc*.63+lane*1.3)),ra=radius,rz=radius;
 if(uKnit>.5){if(uPlies>1.5){P+=.001*.48*radius*(cos(phase+ply*TAU/3.)*B+sin(phase+ply*TAU/3.)*W);ra=rz=radius*.55;}else{ra=rz=radius*1.05;}}
 else{ra=(uKind<.5?uPitch:uWeftPitch)*.51*uPacking;rz=uThickness*(uKind<.5?.235:.17);ra*=1.+.025*sin(t*.31+lane*2.3);}
 vec3 radial=B*(cos(theta)*ra)+W*(sin(theta)*rz);NN=normalize(B*cos(theta)/ra+W*sin(theta)/rz);
 if(abs(tubeCap)>.5){float enabled=tubeCap<0.?yarnEnds.x:yarnEnds.y;P+=enabled>.5?vec3(0.):radial*.001;NN=T*sign(tubeCap);}else P+=radial*.001;
 if(uLOD<.5&&uKnit<.5)NN=normalize(N*.75+NN*.25);
 vSolidColour=uKnit>.5?mix(uDye,uContrast,carrier):mix(uDye,uWeftDye,uKind);vSolidColour*=1.+.028*sin(arc*.67+lane*1.47);vSolidColour=mix(vSolidColour,vec3(.52),uPlain);vSolidCoord=vec3(arc,theta,lane);
}
`;
export const yarnFragment=`
uniform float uKnit,uTwist,uLOD,uPlain;
float twistPhase=vSolidCoord.y*3.-vSolidCoord.x*6.2831853/uTwist;
float footprint=max(fwidth(twistPhase),.001),detail=1.-smoothstep(.7,3.,footprint);
float groove=.5+.5*cos(twistPhase);diffuseColor.rgb*=1.-.07*detail*groove*(1.-uPlain);
`;
export const leatherShader=`
attribute float shellLayer,shellRim;attribute vec2 rimUV;
uniform float uThickness,uDepth,uTile,uPlain;uniform vec3 uDye;
varying vec3 vSolidColour;varying vec3 vSolidCoord;varying float vLeatherLayer;varying float vLeatherRim;
${bindingGLSL}
${leatherFieldGLSL}
void solidVertex(out vec3 P,out vec3 NN){vec3 N,U,V;surfaceFrame(uv,P,N,U,V);vec4 f=leatherField(uv/uTile);float h=uThickness+(f.x-.5)*uDepth;P+=N*(.2+shellLayer*h)*.001;
 NN=shellLayer>.5?N:-N;if(shellRim>.5)NN=normalize(U*rimUV.x+V*rimUV.y);
 vSolidColour=uDye*(.94+.12*f.w);vSolidColour=mix(vSolidColour,vec3(.52),uPlain);vSolidCoord=vec3(uv,0.);vLeatherLayer=shellLayer;vLeatherRim=shellRim;
}
`;
export const leatherFragmentHead=`
varying float vLeatherLayer;varying float vLeatherRim;uniform float uDepth,uTile,uPlain;
${leatherFieldGLSL}
`;
export const leatherNormalFragment=`
if(vLeatherLayer>.5&&vLeatherRim<.5){
 vec2 lq=vSolidCoord.xy/uTile;vec4 lf=leatherField(lq);
 vec3 px=dFdx(vViewPosition),py=dFdy(vViewPosition);vec2 ux=dFdx(vSolidCoord.xy),uy=dFdy(vSolidCoord.xy);
 float det=ux.x*uy.y-ux.y*uy.x;float stepMM=max(.035,max(length(ux),length(uy))*.65);
 float dx=(leatherField(lq+vec2(stepMM/uTile,0.)).x-leatherField(lq-vec2(stepMM/uTile,0.)).x)*uDepth/(2.*stepMM);
 float dy=(leatherField(lq+vec2(0.,stepMM/uTile)).x-leatherField(lq-vec2(0.,stepMM/uTile)).x)*uDepth/(2.*stepMM);
 if(abs(det)>1e-12){vec3 U=-(px*uy.y-py*ux.y)/det,V=-(py*ux.x-px*uy.x)/det;vec3 T=normalize(U-normal*dot(U,normal)),B=normalize(V-normal*dot(V,normal));float attenuation=1.-smoothstep(.45,1.8,stepMM);normal=normalize(normal-(T*dx+B*dy)*attenuation*(1.-uPlain));}
 roughnessFactor=clamp(roughnessFactor+(lf.y-.55)*.075,.12,.98);
}else{roughnessFactor=.92;}
`;
