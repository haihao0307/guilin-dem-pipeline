@group(0) @binding(0) var<storage,read_write> outv: array<u32,24>;

fn sample_hash(i:u32)->u32 {
  switch i {
    case 0u:{return 0u;} case 1u:{return 1u;} case 2u:{return 0xffu;} case 3u:{return 0x100u;}
    case 4u:{return 0xffffff7fu;} case 5u:{return 0xffffff80u;} case 6u:{return 0xfffffffeu;} default:{return 0xffffffffu;}
  }
}
fn map_value(h:u32,m:u32)->f32 {
  if(m==0u){return f32(h)/4294967295.0;}
  if(m==1u){return f32(h>>8u)/16777216.0;}
  return bitcast<f32>(0x3f800000u|(h>>9u))-1.0;
}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id:vec3<u32>){
  if(id.x<24u){outv[id.x]=bitcast<u32>(map_value(sample_hash(id.x/3u),id.x%3u));}
}
