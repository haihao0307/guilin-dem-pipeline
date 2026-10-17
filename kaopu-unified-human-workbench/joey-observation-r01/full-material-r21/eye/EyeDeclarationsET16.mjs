export const declarations=`
uniform sampler2D neOriginal0,neOriginal1,neClean,neVessels;
uniform float neEnabled,neReference,neReady;
uniform vec4 neIris[2],neTint[2],neInner[2],neSclera[2],neMisc[2],neSurface[2],neEdge[2],neContactSettings[2];
varying vec4 vNEContact;
int neSide(){return vFEye.w>.5?1:0;}
vec2 neAtlas(vec2 q,int side,float source){vec2 center=side==0?vec2(.7104,.3032):vec2(.2896,.6988);float radius=source<.5?.1185:.1215;return clamp(center+vec2(q.x,-q.y)*radius,vec2(.001),vec2(.999));}
vec3 neSource(vec2 uv,float source){vec3 a=texture2D(neOriginal0,uv).rgb,b=texture2D(neOriginal1,uv).rgb;return mix(a,b,step(.5,source));}
vec2 neRefract(vec2 q,int side){
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);vec2 ux=dFdx(vFEye.xy),uy=dFdy(vFEye.xy);float det=ux.x*uy.y-ux.y*uy.x;
 #ifdef FLAT_SHADED
 vec3 refractiveNormal=normalize(cross(dx,dy));
 #else
 vec3 refractiveNormal=normalize(vNormal);
 #endif
 if(abs(det)>1e-12){vec3 tx=(dx*uy.y-dy*ux.y)/det,ty=(dy*ux.x-dx*uy.x)/det;vec3 n=refractiveNormal,ray=refract(-normalize(vViewPosition),n,1./1.376);float z=max(.35,abs(dot(ray,n)));vec2 shift=vec2(dot(ray,normalize(tx))/max(length(tx),.002),dot(ray,normalize(ty))/max(length(ty),.002))*.0012*neSurface[side].w/z;q+=clamp(shift,vec2(-.16),vec2(.16))*(1.-smoothstep(.8,1.18,length(q)));}return q;
}
vec3 neEyeColor(){
 int side=neSide();vec4 iris=neIris[side],tint=neTint[side],inner=neInner[side],sclera=neSclera[side],misc=neMisc[side];vec2 q=vFEye.xy;
 if(neReference>.5)return neSource(neAtlas(q,side,iris.w),iris.w);
 q=neRefract(q,side)/iris.x;float rotation=misc.z;q=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation))*q;
 float r=length(q),aa=max(fwidth(r),neEdge[side].z),sourcePupil=iris.w<.5?.405:.295;
 float nativeRadius=sourcePupil+clamp((r-iris.y)/(1.-iris.y),0.,1.)*(.94-sourcePupil);
 vec2 iq=q/max(r,.0001)*nativeRadius;vec3 color=neSource(neAtlas(iq,side,iris.w),iris.w);
 float lum=max(dot(color,vec3(.2126,.7152,.0722)),.006);
 vec3 recolored=tint.rgb*clamp(lum/.125,.16,2.4);color=mix(color,recolored,tint.a);
 float innerMask=1.-smoothstep(iris.y+.04,iris.y+.32,r);vec3 innerPaint=inner.rgb*clamp(lum/.125,.16,2.4);color=mix(color,innerPaint,inner.a*innerMask);
 color=max(vec3(.001),mix(vec3(lum),color,misc.w));color*=iris.z;
 color*=1.-misc.y*.40*smoothstep(1.-neEdge[side].x,.995,r);
 vec2 sq=vFEye.xy;float sr=length(sq);sq*=min(1.,2.3/max(sr,.001));vec2 suv=neAtlas(sq,side,0.);
 vec3 white=texture2D(neClean,suv).rgb;white=mix(white,vec3(.73,.72,.68),sclera.x*.68);
 white*=vec3(1.,1.-sclera.y*.11,1.-sclera.y*.38);
 float corner=smoothstep(1.05,2.15,sr);white*=vec3(1.+sclera.z*.055,1.-sclera.z*(.09+.18*corner),1.-sclera.z*(.065+.13*corner));
 vec4 vein=texture2D(neVessels,suv);float coverage=smoothstep(vein.b-.045,vein.b+.045,misc.x)*step(.001,misc.x);float vascular=clamp(mix(vein.r,vein.g,neEdge[side].w)*coverage*sclera.w,0.,1.);
 white=mix(white,white*vec3(.70,.23,.19),vascular*.70);
 float irisMask=1.-smoothstep(1.-neEdge[side].y-aa,1.015+aa,r);vec3 result=mix(white,color,irisMask);
 float pupilMask=1.-smoothstep(iris.y-aa,iris.y+aa,r);result=mix(result,vec3(.0015,.0019,.0022),pupilMask);
 return result;
}
// Finite-source approximation, driven by the actual scene light uniforms.
float neStudioReflection(vec3 n,vec3 lightDirection,float angularWidth){
 vec3 eyeView=normalize(vViewPosition),reflection=reflect(-eyeView,n),L=normalize(lightDirection);
 vec3 X=normalize(cross(abs(L.y)>.98?vec3(1.,0.,0.):vec3(0.,1.,0.),L)),Y=cross(L,X);float forward=dot(reflection,L);
 vec2 q=vec2(dot(reflection,X),dot(reflection,Y))/max(forward,.001);
 float a=max(angularWidth,.03),soft=max(fwidth(q.x)+fwidth(q.y),.012);
 float box=(1.-smoothstep(a-soft,a+soft,abs(q.x)))*(1.-smoothstep(a*1.8-soft,a*1.8+soft,abs(q.y)))*step(0.,forward);
 float fresnel=.025+.975*pow(1.-max(dot(eyeView,n),0.),5.);return box*fresnel;
}
`;
