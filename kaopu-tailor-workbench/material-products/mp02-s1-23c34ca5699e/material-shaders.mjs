import {leatherFieldGLSL} from './leather-field.mjs';
import './cotton-surface.js';
const Cotton=globalThis.KAOPUCottonSurface;
const shaderMap=`
uniform sampler2D uPositions,uNormals;uniform vec2 uGrid,uOrigin;uniform float uGridStep;
vec3 chartValue(sampler2D data,vec2 xy){vec2 q=clamp((xy-uOrigin)/uGridStep,vec2(0.),uGrid-1.001);ivec2 a=ivec2(floor(q));vec2 f=fract(q);return mix(mix(texelFetch(data,a,0).xyz,texelFetch(data,a+ivec2(1,0),0).xyz,f.x),mix(texelFetch(data,a+ivec2(0,1),0).xyz,texelFetch(data,a+ivec2(1,1),0).xyz,f.x),f.y);}
vec3 atChart(vec2 xy){return chartValue(uPositions,xy);}vec3 chartNormal(vec2 xy){return normalize(chartValue(uNormals,xy));}
`;
export const yarnShader=`
attribute vec4 yarnInterval;attribute vec2 yarnEnds;attribute vec3 tubeCoordinate;attribute float tubeCap;
uniform float uKnit,uKind,uPitch,uWeftPitch,uThickness,uYarnRadius,uPattern,uReverse,uVariation,uTwist,uOffset,uSeed,uSlub,uWeave,uPlain;
uniform vec3 uDye,uContrast,uWeftDye;varying vec3 vSolidColour;varying vec3 vSolidCoord;
const float TAU=6.28318530718,COURSE=.716197243913;
${shaderMap}
${Cotton.shapeGLSL}
float chartColour(vec2 id){if(uPattern<.5)return 0.;vec2 p=mod(id,16.);if(uPattern>2.5&&uPattern<3.5)return mod(p.y,8.)<4.?0.:1.;if(uPattern>3.5)return mod(floor(p.x/4.)+floor(p.y/4.),2.);float d=abs(p.x-7.5)+abs(p.y-7.5);return abs(d-6.)<1.1?1.:(mod(p.x+p.y,5.)<.5?1.:0.);}
float sm7(float t){t=clamp(t,0.,1.);return t*t*t*t*(35.+t*(-84.+t*(70.-20.*t)));}
float endBlend(float t){float d=min(t,1.-t);return 1.-sm7(d/.3);}
float stitchArc(float t){return 3.926862432*t-.019512499729*sin(2.*TAU*t)+.012534954656*sin(4.*TAU*t)+.000256499088*sin(6.*TAU*t)-.000120229580*sin(8.*TAU*t)-.000009090432*sin(10.*TAU*t)+.000002920105*sin(12.*TAU*t);}
float draft(float x,float y){float n=uWeave>.5&&uWeave<1.5?3.:4.;float shift=uWeave>1.5&&uWeave<2.5?-x:x;if(uWeave>2.5){float j=mod(x,4.);shift=j<.5?0.:j<1.5?1.:j<2.5?3.:2.;}return mod(y-shift,n)<n-1.-.001?1.:-1.;}
float weaveHeight(float travel,float lane){float t=travel/(uKind<.5?uWeftPitch:uPitch),a=floor(t-.5),f=fract(t-.5);f=f*f*(3.-2.*f);float aa=uKind<.5?draft(lane,a):-draft(a,lane),bb=uKind<.5?draft(lane,a+1.):-draft(a+1.,lane);return mix(aa,bb,f)*uThickness*.265-(uKind>.5?uThickness*.235*.18:0.);}
vec3 restYarn(float t,float lane,float carrier){
 if(uKnit>.5){float u=fract(t),a=TAU*u,c=chartColour(vec2(floor(t),lane));bool working=uPattern<.5||abs(c-carrier)<.1;vec3 p=vec3(t+.238732414638*sin(2.*a),lane*COURSE+.636619772368*cos(a),-.159154943092*cos(2.*a));
 if(!working){p=vec3(t,lane*COURSE+.636619772368,-.159154943092);for(int end=0;end<2;end++){float v=end==0?u:1.-u;if(v<.3)p.y-=.785398163397*v*v*(1.-sm7(v/.3));}}
 p.z*=uReverse;p*=uPitch;if(uPattern>.5)p.z-=(.6+2.2*carrier)*uYarnRadius*(working?endBlend(u):1.);return p;
 }
 float z=weaveHeight(t,lane),q=t/(uKind<.5?uWeftPitch:uPitch),ph=lane+uKind*79.,gate=sin(3.14159265*(q-.5));float wander=uSlub*gate*(.036*sin(q*.37+ph*.71)+.021*sin(q*.113+ph*1.9));z+=.023*uSlub*gate*gate*sin(q*.48+ph*.67);
 return uKind<.5?vec3((lane+.5)*uPitch+wander,t,z):vec3(t,(lane+.5)*uWeftPitch+wander,z);
}
vec3 yarnCentre(float t,float lane,float carrier){vec3 q=restYarn(t,lane,carrier);return atChart(q.xy)+chartNormal(q.xy)*(q.z+uOffset)*.001;}
void solidVertex(out vec3 P,out vec3 NN){float t=mix(yarnInterval.x,yarnInterval.y,tubeCoordinate.x),lane=yarnInterval.z,carrier=yarnInterval.w,theta=tubeCoordinate.y,ply=tubeCoordinate.z,eps=uKnit>.5?.001:.006;vec3 q=restYarn(t,lane,carrier),N=chartNormal(q.xy),T=normalize(yarnCentre(t+eps,lane,carrier)-yarnCentre(t-eps,lane,carrier)+vec3(1e-12)),B=cross(T,N);if(dot(B,B)<1e-10)B=cross(abs(N.y)<.85?vec3(0,1,0):vec3(1,0,0),N);B=normalize(B);vec3 W=normalize(cross(B,T));P=yarnCentre(t,lane,carrier);
 float arc=uKnit>.5?(floor(t)*3.926862432+stitchArc(fract(t)))*uPitch:t;
 float phase=TAU*arc/uTwist+lane*.31,variation=1.+uVariation*(.6*sin(arc*.67+lane*1.31)+.4*sin(arc*1.4807+lane*.79));
 float radius=uYarnRadius,ra=radius,rz=radius;
 if(uKnit>.5){radius*=variation;P+=.001*.51*radius*(cos(phase+ply*TAU/3.)*B+sin(phase+ply*TAU/3.)*W);ra=rz=radius*.43;}
 else{float bulge=.5+.5*sin(t*.10+lane*19.31);float irregular=clamp(1.+uSlub*(.20*sin(lane*3.71)+.24*(bulge-.5)+.045*sin(t*.61+lane)),.84,1.09);ra=(uKind<.5?uPitch*.49:uWeftPitch*.235)*irregular;rz=uThickness*.235*(uKind<.5?1.:.68)*(1.+uSlub*.14*(bulge-.5));float pack=cottonPacking(theta,t,lane+uKind*79.).x;ra*=pack;rz*=pack;}
 vec3 radial=B*(cos(theta)*ra)+W*(sin(theta)*rz);NN=normalize(B*cos(theta)/ra+W*sin(theta)/rz);
 if(abs(tubeCap)>.5){float enabled=tubeCap<0.?yarnEnds.x:yarnEnds.y;P+=enabled>.5?vec3(0.):radial*.001;NN=T*sign(tubeCap);}else P+=radial*.001;
 vSolidColour=uKnit>.5?mix(uDye,uContrast,carrier):mix(uDye,uWeftDye,uKind);vSolidColour*=1.+(uKnit>.5?.07:.06)*sin(arc*.57+lane*2.371+ply*.8);vSolidColour=mix(vSolidColour,vec3(.52),uPlain);vSolidCoord=vec3(arc,theta,lane);
}
`;
export const leatherShader=`attribute vec3 baseNormal;attribute float shellLayer,shellRim;uniform float uThickness,uDepth,uTile,uPlain;uniform vec3 uDye;varying vec3 vSolidColour;varying vec3 vSolidCoord;${leatherFieldGLSL}
void solidVertex(out vec3 P,out vec3 NN){vec2 q=uv/uTile;vec4 f=leatherField(q);float height=uThickness+(f.x-.5)*uDepth;P=position+baseNormal*(.2+shellLayer*height)*.001;NN=normal;if(shellRim<.5&&shellLayer>.5){float e=.08;float dx=(leatherField(q+vec2(e/uTile,0.)).x-leatherField(q-vec2(e/uTile,0.)).x)*uDepth/(2.*e),dy=(leatherField(q+vec2(0.,e/uTile)).x-leatherField(q-vec2(0.,e/uTile)).x)*uDepth/(2.*e);vec3 axis=abs(baseNormal.y)<.85?vec3(0,1,0):vec3(1,0,0),T=normalize(cross(axis,baseNormal)),B=cross(baseNormal,T);NN=normalize(baseNormal-T*dx-B*dy);}
vSolidColour=uDye*(.90+.18*f.w);if(shellLayer<.5||shellRim>.5)vSolidColour*=vec3(1.18,1.08,.92);vSolidColour=mix(vSolidColour,vec3(.52),uPlain);vSolidCoord=vec3(uv,0.);}`;
