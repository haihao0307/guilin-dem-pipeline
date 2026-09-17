@group(0) @binding(0) var<storage,read_write> outv: array<u32,12>;

fn h1(input:u32)->u32 {
  var x=input;
  x^=x>>16u;
  x*=0x7feb352du;
  x^=x>>15u;
  x*=0x846ca68bu;
  x^=x>>16u;
  return x;
}

fn rotl16(x:u32)->u32 { return (x<<16u)|(x>>16u); }
fn hp(p:vec2<i32>)->u32 { return h1(h1(bitcast<u32>(p.x))^rotl16(h1(bitcast<u32>(p.y)))^0x9e3779b9u); }

fn cell(i:u32)->vec2<i32> {
  switch i {
    case 0u:{return vec2<i32>(bitcast<i32>(0x80000000u),bitcast<i32>(0x80000000u));}
    case 1u:{return vec2<i32>(bitcast<i32>(0x80000000u),-1i);}
    case 2u:{return vec2<i32>(-16777217i,16777217i);}
    case 3u:{return vec2<i32>(-65536i,65536i);}
    case 4u:{return vec2<i32>(-1i,-1i);}
    case 5u:{return vec2<i32>(-1i,0i);}
    case 6u:{return vec2<i32>(0i,-1i);}
    case 7u:{return vec2<i32>(0i,0i);}
    case 8u:{return vec2<i32>(0i,1i);}
    case 9u:{return vec2<i32>(1i,0i);}
    case 10u:{return vec2<i32>(1i,1i);}
    default:{return vec2<i32>(2147483647i,2147483647i);}
  }
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id:vec3<u32>) {
  if(id.x<12u) { outv[id.x]=hp(cell(id.x)); }
}
