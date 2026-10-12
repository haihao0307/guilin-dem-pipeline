// Rigid component frames only: orthogonal rotations and reflections, in metres.
// World noise remains world-space. Bounds are authored in this exact local frame.
export const MATERIAL_FRAME=String.raw`
struct MaterialFrame { worldToLocal:mat3x3<f32>, lower:vec3<f32>, upper:vec3<f32>, enabled:f32 };
fn identityFrame()->MaterialFrame {return MaterialFrame(mat3x3<f32>(vec3<f32>(1.,0.,0.),vec3<f32>(0.,1.,0.),vec3<f32>(0.,0.,1.)),vec3<f32>(0.),vec3<f32>(0.),0.);}
fn rigidIdentity()->mat3x3<f32>{return mat3x3<f32>(vec3<f32>(1.,0.,0.),vec3<f32>(0.,1.,0.),vec3<f32>(0.,0.,1.));}
fn rigidWest()->mat3x3<f32>{return mat3x3<f32>(vec3<f32>(0.,0.,1.),vec3<f32>(0.,1.,0.),vec3<f32>(1.,0.,0.));}
fn componentVector(f:Field,v:vec3<f32>)->vec3<f32>{if(f.component.enabled>.5&&u.clock.z>.5){return f.component.worldToLocal*v;}return v;}
fn componentTangent(f:Field,n:vec3<f32>)->vec3<f32>{let ln=componentVector(f,n);let lt=normalize(cross(ln,select(vec3<f32>(0.,1.,0.),vec3<f32>(1.,0.,0.),abs(ln.y)>.85)));if(f.component.enabled>.5&&u.clock.z>.5){return transpose(f.component.worldToLocal)*lt;}return lt;}
fn componentFootprint(f:Field,fp:f32,dx:vec3<f32>,dy:vec3<f32>)->f32{return max(fp,max(length(componentVector(f,dx)),length(componentVector(f,dy))));}
fn offsetComponent(f:Field,worldOffset:vec3<f32>)->Field{var g=f;g.local+=componentVector(f,worldOffset);return g;}
`;
// CPU contract reference. Row-major matrices here, packed by columns for WGSL.
export const toLocalDirection=(frame,v)=>[0,1,2].map(r=>frame.worldToLocal[r*3]*v[0]+frame.worldToLocal[r*3+1]*v[1]+frame.worldToLocal[r*3+2]*v[2]);
export const toLocalPoint=(frame,p)=>toLocalDirection(frame,p.map((v,i)=>v-frame.origin[i]));
export const localFootprint=(frame,dx,dy)=>Math.max(Math.hypot(...toLocalDirection(frame,dx)),Math.hypot(...toLocalDirection(frame,dy)));
export function materialInput(frame,{point,normal,tangent,dx,dy}){return {point:toLocalPoint(frame,point),normal:toLocalDirection(frame,normal),tangent:toLocalDirection(frame,tangent),dx:toLocalDirection(frame,dx),dy:toLocalDirection(frame,dy),footprint:localFootprint(frame,dx,dy),extentMin:[...frame.extentMin],extentMax:[...frame.extentMax],worldNoisePosition:[...point]};}
