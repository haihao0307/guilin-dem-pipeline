/** Display-only planar clipping of AUTHORITATIVE finite assembly solids.
 * No new geometry, shell thickening, source-patch fill, or identity is created.
 * Include after the original assembly field, CAMERA and REDUCE shader chunks.
 */
export const ASSEMBLY_SECTION_CAP_GLSL=`
// Track which retained-domain boundary really came from a display cut. Bounds
// and previous nearest hits never acquire a cut normal and cannot become caps.
bool assemblySectionInterval(vec3 ro,vec3 rd,inout float lo,inout float hi,out vec3 loNormal,out vec3 hiNormal){
 loNormal=vec3(0.);hiNormal=vec3(0.);
 if(uSlice){
  if(abs(rd.y)<1e-12){if(ro.y<uSliceY.x||ro.y>uSliceY.y)return false;}
  else{
   float a=(uSliceY.x-ro.y)/rd.y,b=(uSliceY.y-ro.y)/rd.y;
   float entry=min(a,b),exitT=max(a,b);vec3 entryNormal=rd.y>0.?vec3(0.,-1.,0.):vec3(0.,1.,0.);
   if(entry>=lo){lo=entry;loNormal=entryNormal;}
   if(exitT<=hi){hi=exitT;hiNormal=-entryNormal;}
   if(hi<lo)return false;
  }
 }
 if(uClip){
  float p=dot(uClipNormal,ro)-uClipOffset,d=dot(uClipNormal,rd);
  if(abs(d)<1e-12){if(p<0.)return false;}
  else{float planeT=-p/d;vec3 n=-normalize(uClipNormal);
   if(d>0.){if(planeT>=lo){lo=planeT;loNormal=n;}}
   else if(planeT<=hi){hi=planeT;hiNormal=n;}
  }
 }
 return hi>=lo;
}
void assemblyAcceptSectionCap(vec3 ro,vec3 rd,float planeT,vec3 cutNormal,float boundsLo,float boundsHi,float instance){
 if(dot(cutNormal,cutNormal)==0.||planeT<0.||planeT<boundsLo||planeT>boundsHi||planeT>outHit.x)return;
 // This is plane INTERSECT solid, not filling an archetype box or a source
 // polygon. Negative authoritative union distance excludes holes, door voids,
 // exterior space and zero-thickness surfaces without a thickness epsilon.
 FieldHit h=mapField(ro+rd*planeT);
 if(h.distance>=0.)return;
 h.objectId+=instance;
 accept(planeT,h,cutNormal,instance);
}
`;

/** CPU mirror of the display-domain intersection, for analytic regressions.
 * Normals point OUT of the retained domain. null means no surviving interval.
 */
export function assemblySectionInterval({ro,rd,nearest=Infinity,sliceY=null,clip=null}){
 let lo=0,hi=nearest,loNormal=null,hiNormal=null;
 if(sliceY){
  if(Math.abs(rd[1])<1e-12){if(ro[1]<sliceY[0]||ro[1]>sliceY[1])return null;}
  else{
   const a=(sliceY[0]-ro[1])/rd[1],b=(sliceY[1]-ro[1])/rd[1],entry=Math.min(a,b),exit=Math.max(a,b),n=rd[1]>0?[0,-1,0]:[0,1,0];
   if(entry>=lo){lo=entry;loNormal=n;}
   if(exit<=hi){hi=exit;hiNormal=n.map(v=>-v);}
   if(hi<lo)return null;
  }
 }
 if(clip){
  const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),p=dot(clip.normal,ro)-clip.offset,d=dot(clip.normal,rd);
  if(Math.abs(d)<1e-12){if(p<0)return null;}
  else{const t=-p/d,n=clip.normal.map(v=>-v/Math.hypot(...clip.normal));if(d>0){if(t>=lo){lo=t;loNormal=n;}}else if(t<=hi){hi=t;hiNormal=n;}}
 }
 return hi>=lo?{lo,hi,loNormal,hiNormal}:null;
}
