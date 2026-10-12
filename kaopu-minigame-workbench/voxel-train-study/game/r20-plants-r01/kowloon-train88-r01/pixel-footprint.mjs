// Station-local metres per physical field pixel. Differentiate the actual
// inverse-projection ray and intersect its differential with the hit tangent
// plane. Works for perspective (including camera.zoom) and orthographic rays.
// At |n dot ray|<1e-5 the infinite plane derivative diverges. Denominator
// regularization keeps values finite there; it is NOT exact silhouette coverage.
// Primary-ray coverage filtering is a separate, still-open acceptance gate.
export const PIXEL_FOOTPRINT_WGSL=String.raw`
fn hostSurfaceDifferentials(pixel:vec2<f32>,p:vec3<f32>,n:vec3<f32>)->mat2x3<f32>{
 var ndc=pixel/frame.viewport.xy*2.-vec2<f32>(1.);var sy=1.;if(frame.viewport.z>.5){ndc.y=-ndc.y;sy=-1.;}
 let a=localPoint(vec4<f32>(ndc,-1.,1.));let b=localPoint(vec4<f32>(ndc,1.,1.));let v=b-a;let vv=dot(v,v);let t=dot(p-a,v)/vv;
 let rawDen=dot(n,v);let den=select(-1.,1.,rawDen>=0.)*max(abs(rawDen),length(v)*.00001);
 var result:mat2x3<f32>;
 for(var axis=0u;axis<2u;axis++){
  let offset=select(vec2<f32>(2./frame.viewport.x,0.),vec2<f32>(0.,2.*sy/frame.viewport.y),axis==1u);
  let da=localPoint(vec4<f32>(ndc+offset,-1.,1.))-a;
  let db=localPoint(vec4<f32>(ndc+offset,1.,1.))-b;
  let unprojected=da+t*(db-da);result[axis]=unprojected-v*(dot(n,unprojected)/den);
 }
 return result;
}
`;
export function surfaceDifferential(a,b,da,db,p,n){
 const sub=(u,v)=>u.map((x,i)=>x-v[i]),dot=(u,v)=>u.reduce((s,x,i)=>s+x*v[i],0),v=sub(b,a),t=dot(sub(p,a),v)/dot(v,v),raw=dot(n,v),den=(raw>=0?1:-1)*Math.max(Math.abs(raw),Math.hypot(...v)*.00001),u=da.map((x,i)=>x+t*(db[i]-x));
 return u.map((x,i)=>x-v[i]*dot(n,u)/den);
}
