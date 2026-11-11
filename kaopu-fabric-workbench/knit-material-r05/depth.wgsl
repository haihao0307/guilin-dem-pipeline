// Exact baseline camera-depth expression evaluated once per pixel.
@group(0) @binding(8) var<storage,read_write> depthCache:array<f32>;
var<workgroup> blockDepth:array<f32,64>;
@compute @workgroup_size(8,8) fn makeDepth(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(local_invocation_index) li:u32,@builtin(workgroup_id) tile:vec3<u32>){
 var z=1.e9;
 if(all(gid.xy<g.dims.xy)){let i=gid.y*g.dims.x+gid.x;z=pixels[i].w*dot(direction(vec2<f32>(gid.xy)+.5),g.forward.xyz);depthCache[i]=z;}
 blockDepth[li]=z;workgroupBarrier();
 for(var stride=32u;stride>0u;stride>>=1u){if(li<stride){blockDepth[li]=max(blockDepth[li],blockDepth[li+stride]);}workgroupBarrier();}
 if(li==0u){let tx=(g.dims.x+7u)/8u;depthCache[g.dims.x*g.dims.y+tile.y*tx+tile.x]=blockDepth[0];}
}
fn segmentHidden(lo:vec2<i32>,hi:vec2<i32>,nearest:f32)->bool{
 if(any(lo>hi)){return true;}
 let a=vec2<u32>(lo)/8u;let b=vec2<u32>(hi)/8u;
 if(any(b-a>vec2<u32>(1u))){return false;}
 let width=(g.dims.x+7u)/8u;let start=g.dims.x*g.dims.y;
 for(var y=a.y;y<=b.y;y++){for(var x=a.x;x<=b.x;x++){
  if(nearest<=depthCache[start+y*width+x]+.0251){return false;}
 }}return true;
}
